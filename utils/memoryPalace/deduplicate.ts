import { ensureFloat32, MemoryLinkDB, MemoryNodeDB, MemoryVectorDB } from './db';
import { cosineSimilarity } from './embedding';
import { removeMemoryFromBox } from './eventBox';
import { deleteVector } from './supabaseVector';
import type { MemoryNode, MemoryVector, RemoteVectorConfig } from './types';

export interface ExactDuplicateMemoryGroup {
    charId: string;
    content: string;
    keep: MemoryNode;
    duplicates: MemoryNode[];
    nodes: MemoryNode[];
    maxSimilarity?: number;
}

export interface ExactDuplicateMemoryPreview {
    scannedCount: number;
    charCount: number;
    groups: ExactDuplicateMemoryGroup[];
    duplicateCount: number;
    vectorizedCount?: number;
    threshold?: number;
}

export interface ExactDuplicateDeletionResult extends ExactDuplicateMemoryPreview {
    deleted: number;
    failed: Array<{ id: string; error: string }>;
    remoteAttempted: boolean;
    remoteDeleted: number;
}

export interface ExactDuplicateScanOptions {
    charIds?: string[];
}

export interface SemanticDuplicateScanOptions extends ExactDuplicateScanOptions {
    threshold?: number;
    minContentLength?: number;
}

export interface ExactDuplicateDeletionOptions {
    remoteConfig?: RemoteVectorConfig;
    onProgress?: (deleted: number, total: number) => void;
}

function duplicateContentKey(content: string): string {
    return (content || '').trim();
}

function hasComparableContent(node: MemoryNode, minContentLength: number): boolean {
    return duplicateContentKey(node.content).length >= minContentLength;
}

function compareCanonicalNode(a: MemoryNode, b: MemoryNode): number {
    const now = Date.now();
    const activePinnedA = !!(a.pinnedUntil && a.pinnedUntil > now);
    const activePinnedB = !!(b.pinnedUntil && b.pinnedUntil > now);
    if (activePinnedA !== activePinnedB) return activePinnedB ? 1 : -1;

    const summaryA = !!a.isBoxSummary;
    const summaryB = !!b.isBoxSummary;
    if (summaryA !== summaryB) return summaryB ? 1 : -1;

    const visibleA = !a.archived;
    const visibleB = !b.archived;
    if (visibleA !== visibleB) return visibleB ? 1 : -1;

    if (a.accessCount !== b.accessCount) return b.accessCount - a.accessCount;
    if (a.importance !== b.importance) return b.importance - a.importance;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;

    const boxedA = !!a.eventBoxId;
    const boxedB = !!b.eventBoxId;
    if (boxedA !== boxedB) return boxedB ? 1 : -1;

    return a.id.localeCompare(b.id);
}

export function findExactDuplicateMemoryGroups(nodes: MemoryNode[]): ExactDuplicateMemoryPreview {
    const byKey = new Map<string, MemoryNode[]>();
    const charIds = new Set<string>();

    for (const node of nodes) {
        charIds.add(node.charId);
        const contentKey = duplicateContentKey(node.content);
        if (!contentKey) continue;
        const key = `${node.charId}\u0000${contentKey}`;
        const bucket = byKey.get(key);
        if (bucket) bucket.push(node);
        else byKey.set(key, [node]);
    }

    const groups: ExactDuplicateMemoryGroup[] = [];
    for (const bucket of byKey.values()) {
        if (bucket.length < 2) continue;
        const ordered = bucket.slice().sort(compareCanonicalNode);
        groups.push({
            charId: ordered[0].charId,
            content: duplicateContentKey(ordered[0].content),
            keep: ordered[0],
            duplicates: ordered.slice(1),
            nodes: ordered,
        });
    }

    groups.sort((a, b) => {
        if (a.charId !== b.charId) return a.charId.localeCompare(b.charId);
        return a.keep.createdAt - b.keep.createdAt;
    });

    return {
        scannedCount: nodes.length,
        charCount: charIds.size,
        groups,
        duplicateCount: groups.reduce((sum, group) => sum + group.duplicates.length, 0),
    };
}

export async function scanExactDuplicateMemories(
    options: ExactDuplicateScanOptions = {},
): Promise<ExactDuplicateMemoryPreview> {
    const allNodes = await MemoryNodeDB.getAll();
    const allowed = options.charIds?.length ? new Set(options.charIds) : null;
    const nodes = allowed ? allNodes.filter(node => allowed.has(node.charId)) : allNodes;
    return findExactDuplicateMemoryGroups(nodes);
}

class DisjointSet {
    private parent = new Map<string, string>();

    add(id: string): void {
        if (!this.parent.has(id)) this.parent.set(id, id);
    }

    find(id: string): string {
        const p = this.parent.get(id);
        if (!p || p === id) return id;
        const root = this.find(p);
        this.parent.set(id, root);
        return root;
    }

    union(a: string, b: string): void {
        this.add(a);
        this.add(b);
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra !== rb) this.parent.set(rb, ra);
    }
}

function vectorByMemoryId(vectors: MemoryVector[]): Map<string, Float32Array> {
    const map = new Map<string, Float32Array>();
    for (const v of vectors) {
        map.set(v.memoryId, ensureFloat32(v.vector));
    }
    return map;
}

export async function scanSemanticDuplicateMemories(
    options: SemanticDuplicateScanOptions = {},
): Promise<ExactDuplicateMemoryPreview> {
    const threshold = options.threshold ?? 0.96;
    const minContentLength = options.minContentLength ?? 8;
    const allNodes = await MemoryNodeDB.getAll();
    const allowed = options.charIds?.length ? new Set(options.charIds) : null;
    const nodes = allowed ? allNodes.filter(node => allowed.has(node.charId)) : allNodes;
    const charIds = new Set(nodes.map(node => node.charId));
    const nodesByChar = new Map<string, MemoryNode[]>();
    for (const node of nodes) {
        const bucket = nodesByChar.get(node.charId);
        if (bucket) bucket.push(node);
        else nodesByChar.set(node.charId, [node]);
    }

    const groups: ExactDuplicateMemoryGroup[] = [];
    let vectorizedCount = 0;

    for (const [charId, charNodes] of nodesByChar) {
        const vectors = vectorByMemoryId(await MemoryVectorDB.getAllByCharId(charId));
        const candidates = charNodes.filter(node =>
            vectors.has(node.id) && hasComparableContent(node, minContentLength)
        );
        vectorizedCount += candidates.length;
        if (candidates.length < 2) continue;

        const dsu = new DisjointSet();
        for (const node of candidates) dsu.add(node.id);

        const pairSimilarity = new Map<string, number>();
        for (let i = 0; i < candidates.length; i++) {
            const a = candidates[i];
            const av = vectors.get(a.id)!;
            for (let j = i + 1; j < candidates.length; j++) {
                const b = candidates[j];
                const bv = vectors.get(b.id)!;
                const similarity = cosineSimilarity(av, bv);
                if (similarity >= threshold) {
                    dsu.union(a.id, b.id);
                    pairSimilarity.set(`${a.id}\u0000${b.id}`, similarity);
                }
            }
        }

        const clusters = new Map<string, MemoryNode[]>();
        for (const node of candidates) {
            const root = dsu.find(node.id);
            const bucket = clusters.get(root);
            if (bucket) bucket.push(node);
            else clusters.set(root, [node]);
        }

        for (const cluster of clusters.values()) {
            if (cluster.length < 2) continue;
            const ordered = cluster.slice().sort(compareCanonicalNode);
            let maxSimilarity = 0;
            for (let i = 0; i < ordered.length; i++) {
                for (let j = i + 1; j < ordered.length; j++) {
                    const direct = pairSimilarity.get(`${ordered[i].id}\u0000${ordered[j].id}`)
                        ?? pairSimilarity.get(`${ordered[j].id}\u0000${ordered[i].id}`)
                        ?? cosineSimilarity(vectors.get(ordered[i].id)!, vectors.get(ordered[j].id)!);
                    if (direct > maxSimilarity) maxSimilarity = direct;
                }
            }
            groups.push({
                charId,
                content: duplicateContentKey(ordered[0].content),
                keep: ordered[0],
                duplicates: ordered.slice(1),
                nodes: ordered,
                maxSimilarity,
            });
        }
    }

    groups.sort((a, b) => {
        if (a.charId !== b.charId) return a.charId.localeCompare(b.charId);
        return a.keep.createdAt - b.keep.createdAt;
    });

    return {
        scannedCount: nodes.length,
        charCount: charIds.size,
        groups,
        duplicateCount: groups.reduce((sum, group) => sum + group.duplicates.length, 0),
        vectorizedCount,
        threshold,
    };
}

async function deleteMemoryNodeCascade(
    nodeId: string,
    remoteConfig?: RemoteVectorConfig,
): Promise<{ remoteDeleted: number }> {
    try { await removeMemoryFromBox(nodeId); } catch { /* best effort cleanup */ }

    const links = await MemoryLinkDB.getByNodeId(nodeId);
    for (const link of links) {
        await MemoryLinkDB.delete(link.id);
    }

    await MemoryVectorDB.delete(nodeId);

    let remoteDeleted = 0;
    if (remoteConfig?.enabled && remoteConfig.initialized) {
        const ok = await deleteVector(remoteConfig, nodeId);
        if (ok) remoteDeleted = 1;
    }

    await MemoryNodeDB.delete(nodeId);
    return { remoteDeleted };
}

export async function applyExactDuplicateMemoryDeletion(
    preview: ExactDuplicateMemoryPreview,
    options: ExactDuplicateDeletionOptions = {},
): Promise<ExactDuplicateDeletionResult> {
    const idsToDelete: string[] = [];
    const seen = new Set<string>();
    for (const group of preview.groups) {
        for (const node of group.duplicates) {
            if (seen.has(node.id)) continue;
            seen.add(node.id);
            idsToDelete.push(node.id);
        }
    }

    let deleted = 0;
    let remoteDeleted = 0;
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of idsToDelete) {
        try {
            const result = await deleteMemoryNodeCascade(id, options.remoteConfig);
            deleted++;
            remoteDeleted += result.remoteDeleted;
            options.onProgress?.(deleted, idsToDelete.length);
        } catch (e: any) {
            failed.push({ id, error: e?.message || String(e) });
        }
    }

    return {
        ...preview,
        deleted,
        failed,
        remoteAttempted: !!(options.remoteConfig?.enabled && options.remoteConfig.initialized),
        remoteDeleted,
    };
}

export async function deduplicateExactMemories(
    scanOptions: ExactDuplicateScanOptions = {},
    deletionOptions: ExactDuplicateDeletionOptions = {},
): Promise<ExactDuplicateDeletionResult> {
    const preview = await scanExactDuplicateMemories(scanOptions);
    return applyExactDuplicateMemoryDeletion(preview, deletionOptions);
}
