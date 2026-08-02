import { ensureFloat32, MemoryLinkDB, MemoryNodeDB, MemoryVectorDB } from './db';
import { cosineSimilarity } from './embedding';
import { removeMemoryFromBox } from './eventBox';
import { deleteVector } from './supabaseVector';
import type { MemoryNode, MemoryVector, RemoteVectorConfig } from './types';
import { extractJson, safeFetchJson } from '../safeApi';

export interface ExactDuplicateMemoryGroup {
    charId: string;
    content: string;
    keep: MemoryNode;
    duplicates: MemoryNode[];
    nodes: MemoryNode[];
    maxSimilarity?: number;
    aiReason?: string;
    confidence?: number;
}

export interface ExactDuplicateMemoryPreview {
    scannedCount: number;
    charCount: number;
    groups: ExactDuplicateMemoryGroup[];
    duplicateCount: number;
    vectorizedCount?: number;
    threshold?: number;
    aiCallCount?: number;
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

export interface AiDuplicateLLMConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface AiSemanticDuplicateScanOptions extends ExactDuplicateScanOptions {
    llmConfig: AiDuplicateLLMConfig;
    charNameById?: Record<string, string>;
    minContentLength?: number;
    onProgress?: (completed: number, total: number, charId: string) => void;
}

export interface ExactDuplicateDeletionOptions {
    remoteConfig?: RemoteVectorConfig;
    onProgress?: (deleted: number, total: number) => void;
}

interface AiRawDuplicateGroup {
    keepId?: unknown;
    canonicalId?: unknown;
    duplicateIds?: unknown;
    duplicates?: unknown;
    ids?: unknown;
    memoryIds?: unknown;
    nodeIds?: unknown;
    reason?: unknown;
    confidence?: unknown;
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

function asCleanId(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asIdList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                const obj = item as { id?: unknown; memoryId?: unknown; nodeId?: unknown };
                return asCleanId(obj.id) || asCleanId(obj.memoryId) || asCleanId(obj.nodeId) || '';
            }
            return '';
        })
        .map(id => id.trim())
        .filter(Boolean);
}

function getAiRawGroups(raw: unknown): AiRawDuplicateGroup[] {
    if (Array.isArray(raw)) return raw.filter(item => item && typeof item === 'object') as AiRawDuplicateGroup[];
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as { groups?: unknown; duplicates?: unknown; suggestions?: unknown };
    for (const candidate of [obj.groups, obj.duplicates, obj.suggestions]) {
        if (Array.isArray(candidate)) {
            return candidate.filter(item => item && typeof item === 'object') as AiRawDuplicateGroup[];
        }
    }
    return [];
}

function clampConfidence(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(1, value));
}

function uniqueExistingNodes(ids: string[], byId: Map<string, MemoryNode>): MemoryNode[] {
    const seen = new Set<string>();
    const nodes: MemoryNode[] = [];
    for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const node = byId.get(id);
        if (node) nodes.push(node);
    }
    return nodes;
}

export function buildAiDuplicatePreviewFromSuggestions(
    nodes: MemoryNode[],
    rawSuggestions: unknown,
): ExactDuplicateMemoryPreview {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const charIds = new Set(nodes.map(node => node.charId));
    const usedDuplicateIds = new Set<string>();
    const groups: ExactDuplicateMemoryGroup[] = [];

    for (const rawGroup of getAiRawGroups(rawSuggestions)) {
        const keepId = asCleanId(rawGroup.keepId) || asCleanId(rawGroup.canonicalId);
        const ids = [
            ...(keepId ? [keepId] : []),
            ...asIdList(rawGroup.duplicateIds),
            ...asIdList(rawGroup.duplicates),
            ...asIdList(rawGroup.ids),
            ...asIdList(rawGroup.memoryIds),
            ...asIdList(rawGroup.nodeIds),
        ];
        const existingNodes = uniqueExistingNodes(ids, byId);
        if (existingNodes.length < 2) continue;

        let keep = keepId ? byId.get(keepId) || null : null;
        if (!keep || !existingNodes.some(node => node.id === keep!.id)) {
            keep = existingNodes.slice().sort(compareCanonicalNode)[0];
        }

        let sameCharNodes = existingNodes.filter(node => node.charId === keep!.charId);
        if (sameCharNodes.length < 2) continue;

        if (usedDuplicateIds.has(keep.id)) {
            const replacement = sameCharNodes
                .filter(node => !usedDuplicateIds.has(node.id))
                .sort(compareCanonicalNode)[0];
            if (!replacement) continue;
            keep = replacement;
            sameCharNodes = sameCharNodes.filter(node => node.charId === keep!.charId);
        }

        const duplicates = sameCharNodes
            .filter(node => node.id !== keep!.id && !usedDuplicateIds.has(node.id))
            .sort(compareCanonicalNode);
        if (duplicates.length === 0) continue;

        for (const node of duplicates) usedDuplicateIds.add(node.id);
        const reason = typeof rawGroup.reason === 'string' ? rawGroup.reason.trim() : undefined;
        const confidence = clampConfidence(rawGroup.confidence);
        groups.push({
            charId: keep.charId,
            content: duplicateContentKey(keep.content),
            keep,
            duplicates,
            nodes: [keep, ...duplicates],
            aiReason: reason || undefined,
            confidence,
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

function clipForAi(content: string): string {
    const text = duplicateContentKey(content);
    return text.length > 700 ? `${text.slice(0, 700)}...` : text;
}

async function requestAiDuplicateSuggestions(
    charId: string,
    charName: string,
    nodes: MemoryNode[],
    llmConfig: AiDuplicateLLMConfig,
): Promise<unknown> {
    const payload = nodes.map(node => ({
        id: node.id,
        content: clipForAi(node.content),
        room: node.room,
        createdAt: node.createdAt,
        archived: !!node.archived,
    }));

    const systemPrompt = `你是记忆宫殿维护工具里的中文语义去重审计员。
你的任务是从同一个角色的记忆列表中找出"意义完全相同、只保留一条也不会丢信息"的重复项。
只标记事实、偏好、承诺、状态完全等价的重复记忆；不要把相似但有新细节、不同时间进展、因果补充、情绪变化的记忆归为重复。
只能使用用户提供的 id，不要发明 id。跨角色重复不在本次任务中考虑。
返回严格 JSON，不要 Markdown，不要解释。格式：
{
  "groups": [
    {
      "keepId": "建议保留的记忆 id",
      "duplicateIds": ["建议删除的重复记忆 id"],
      "reason": "为什么这些记忆可以视为完全重复",
      "confidence": 0.0
    }
  ]
}
confidence 是 0 到 1 的数字。没有重复时返回 {"groups":[]}`;

    const userPrompt = `角色：${charName || charId}
记忆列表 JSON：
${JSON.stringify(payload, null, 2)}`;

    const data = await safeFetchJson(
        `${llmConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${llmConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: llmConfig.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                max_tokens: 6000,
                stream: false,
            }),
        },
        1,
        180_000,
        { appName: '记忆宫殿', purpose: 'AI语义去重扫描', characterId: charId },
    );

    const reply = data.choices?.[0]?.message?.content || '';
    const parsed = extractJson(reply);
    if (!parsed) {
        throw new Error(`AI 没有返回可解析的 JSON：${reply.slice(0, 160)}`);
    }
    return parsed;
}

export async function scanAiSemanticDuplicateMemories(
    options: AiSemanticDuplicateScanOptions,
): Promise<ExactDuplicateMemoryPreview> {
    const llmConfig = options.llmConfig;
    if (!llmConfig?.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
        throw new Error('AI 去重需要完整的 baseUrl、apiKey 和 model');
    }

    const minContentLength = options.minContentLength ?? 4;
    const allNodes = await MemoryNodeDB.getAll();
    const allowed = options.charIds?.length ? new Set(options.charIds) : null;
    const nodes = (allowed ? allNodes.filter(node => allowed.has(node.charId)) : allNodes)
        .filter(node => hasComparableContent(node, minContentLength));
    const charIds = new Set(nodes.map(node => node.charId));
    const nodesByChar = new Map<string, MemoryNode[]>();
    for (const node of nodes) {
        const bucket = nodesByChar.get(node.charId);
        if (bucket) bucket.push(node);
        else nodesByChar.set(node.charId, [node]);
    }

    const charBatches = Array.from(nodesByChar.entries()).filter(([, charNodes]) => charNodes.length >= 2);
    const groups: ExactDuplicateMemoryGroup[] = [];
    let completed = 0;

    for (const [charId, charNodes] of charBatches) {
        const raw = await requestAiDuplicateSuggestions(
            charId,
            options.charNameById?.[charId] || charId,
            charNodes,
            llmConfig,
        );
        const preview = buildAiDuplicatePreviewFromSuggestions(charNodes, raw);
        groups.push(...preview.groups);
        completed++;
        options.onProgress?.(completed, charBatches.length, charId);
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
        aiCallCount: charBatches.length,
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
