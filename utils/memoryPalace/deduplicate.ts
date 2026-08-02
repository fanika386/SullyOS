import { MemoryLinkDB, MemoryNodeDB, MemoryVectorDB } from './db';
import { removeMemoryFromBox } from './eventBox';
import { deleteVector } from './supabaseVector';
import type { MemoryNode, RemoteVectorConfig } from './types';

export interface ExactDuplicateMemoryGroup {
    charId: string;
    content: string;
    keep: MemoryNode;
    duplicates: MemoryNode[];
    nodes: MemoryNode[];
}

export interface ExactDuplicateMemoryPreview {
    scannedCount: number;
    charCount: number;
    groups: ExactDuplicateMemoryGroup[];
    duplicateCount: number;
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

export interface ExactDuplicateDeletionOptions {
    remoteConfig?: RemoteVectorConfig;
    onProgress?: (deleted: number, total: number) => void;
}

function duplicateContentKey(content: string): string {
    return (content || '').trim();
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
