import { ensureFloat32, MemoryLinkDB, MemoryNodeDB, MemoryVectorDB } from './db';
import { cosineSimilarity } from './embedding';
import { removeMemoryFromBox } from './eventBox';
import { deleteVector } from './supabaseVector';
import { ROOM_LABELS } from './types';
import type { MemoryNode, MemoryRoom, MemoryVector, RemoteVectorConfig } from './types';
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
    minConfidence?: number;
    onProgress?: (completed: number, total: number, charId: string) => void;
}

export interface AiMergedMemoryDraft {
    content: string;
    room: MemoryRoom;
    tags: string[];
    importance: number;
    mood: string;
    reason?: string;
    sourceIds: string[];
}

export interface CharacterDedupScanScope {
    charIds: string[];
    scopeLabel: string;
    ownerName: string;
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

interface AiRawDuplicateCandidate {
    id?: unknown;
    memoryId?: unknown;
    nodeId?: unknown;
    verdict?: unknown;
    reason?: unknown;
    confidence?: unknown;
    lostIfDeleted?: unknown;
    uniqueInfoLost?: unknown;
    newInformation?: unknown;
}

interface AiAcceptedDuplicateCandidate {
    id: string;
    reason?: string;
    confidence: number;
}

const DEFAULT_AI_DUPLICATE_MIN_CONFIDENCE = 0.92;
const AI_DETAIL_EXTRA_CHARS = 8;
const AI_DETAIL_EXTRA_RATIO = 1.15;
const MEMORY_ROOMS = Object.keys(ROOM_LABELS) as MemoryRoom[];

function duplicateContentKey(content: string): string {
    return (content || '').trim();
}

function compactSemanticText(content: string): string {
    return duplicateContentKey(content)
        .replace(/\s+/g, '')
        .replace(/[，。！？、,.!?;；:："“”'‘’（）()[\]{}《》<>]/g, '');
}

function hasMeaningfullyMoreDetail(candidate: MemoryNode, keep: MemoryNode): boolean {
    const candidateText = compactSemanticText(candidate.content);
    const keepText = compactSemanticText(keep.content);
    const extra = candidateText.length - keepText.length;
    if (extra < AI_DETAIL_EXTRA_CHARS) return false;
    return candidateText.length >= Math.ceil(Math.max(keepText.length, 1) * AI_DETAIL_EXTRA_RATIO);
}

function hasComparableContent(node: MemoryNode, minContentLength: number): boolean {
    return duplicateContentKey(node.content).length >= minContentLength;
}

function clampImportance(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(10, Math.round(n)));
}

function uniqueTags(tags: unknown[], fallbackTags: string[] = []): string[] {
    const result: string[] = [];
    const push = (value: unknown) => {
        if (typeof value !== 'string') return;
        const tag = value.trim();
        if (!tag || result.includes(tag)) return;
        result.push(tag);
    };
    tags.forEach(push);
    fallbackTags.forEach(push);
    return result.slice(0, 12);
}

function resolveMemoryRoom(value: unknown, fallback: MemoryRoom): MemoryRoom {
    return typeof value === 'string' && MEMORY_ROOMS.includes(value as MemoryRoom)
        ? value as MemoryRoom
        : fallback;
}

export function resolveCharacterDedupScanScope(
    character: { id?: string; name?: string } | null | undefined,
): CharacterDedupScanScope {
    const id = character?.id?.trim();
    if (!id) throw new Error('需要先选择一个角色');
    const ownerName = character?.name?.trim() || id;
    return {
        charIds: [id],
        scopeLabel: `【${ownerName}】`,
        ownerName,
    };
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

function normalizeAiVerdict(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasLostInformation(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.some(item => {
            if (typeof item === 'string') return !!item.trim();
            return item != null;
        });
    }
    if (typeof value === 'string') return !!value.trim();
    if (value == null) return false;
    return true;
}

function getCandidateId(candidate: AiRawDuplicateCandidate): string | null {
    return asCleanId(candidate.id) || asCleanId(candidate.memoryId) || asCleanId(candidate.nodeId);
}

function getAcceptedAiDuplicateCandidates(
    rawGroup: AiRawDuplicateGroup,
    minConfidence: number,
): AiAcceptedDuplicateCandidate[] {
    const accepted: AiAcceptedDuplicateCandidate[] = [];
    const arrays = [rawGroup.duplicates, rawGroup.duplicateIds];

    for (const value of arrays) {
        if (!Array.isArray(value)) continue;
        for (const item of value) {
            if (!item || typeof item !== 'object') continue;
            const candidate = item as AiRawDuplicateCandidate;
            const id = getCandidateId(candidate);
            if (!id) continue;

            const verdict = normalizeAiVerdict(candidate.verdict);
            if (verdict !== 'exact_duplicate') continue;

            const confidence = clampConfidence(candidate.confidence) ?? clampConfidence(rawGroup.confidence);
            if (confidence == null || confidence < minConfidence) continue;

            if (candidate.newInformation === true) continue;
            if (hasLostInformation(candidate.lostIfDeleted) || hasLostInformation(candidate.uniqueInfoLost)) continue;

            const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : undefined;
            accepted.push({ id, reason: reason || undefined, confidence });
        }
    }

    return accepted;
}

export function buildAiDuplicatePreviewFromSuggestions(
    nodes: MemoryNode[],
    rawSuggestions: unknown,
    options: { minConfidence?: number } = {},
): ExactDuplicateMemoryPreview {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const charIds = new Set(nodes.map(node => node.charId));
    const usedDuplicateIds = new Set<string>();
    const groups: ExactDuplicateMemoryGroup[] = [];
    const minConfidence = options.minConfidence ?? DEFAULT_AI_DUPLICATE_MIN_CONFIDENCE;

    for (const rawGroup of getAiRawGroups(rawSuggestions)) {
        const keepId = asCleanId(rawGroup.keepId) || asCleanId(rawGroup.canonicalId);
        const acceptedCandidates = getAcceptedAiDuplicateCandidates(rawGroup, minConfidence);
        if (acceptedCandidates.length === 0) continue;

        const ids = [
            ...(keepId ? [keepId] : []),
            ...acceptedCandidates.map(candidate => candidate.id),
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

        const acceptedById = new Map(acceptedCandidates.map(candidate => [candidate.id, candidate]));
        const duplicates = sameCharNodes
            .filter(node =>
                node.id !== keep!.id
                && acceptedById.has(node.id)
                && !usedDuplicateIds.has(node.id)
                && !hasMeaningfullyMoreDetail(node, keep!)
            )
            .sort(compareCanonicalNode);
        if (duplicates.length === 0) continue;

        for (const node of duplicates) usedDuplicateIds.add(node.id);
        const reason = typeof rawGroup.reason === 'string' ? rawGroup.reason.trim() : undefined;
        const confidence = duplicates.reduce((min, node) => {
            const c = acceptedById.get(node.id)?.confidence ?? 1;
            return Math.min(min, c);
        }, 1);
        const candidateReason = duplicates
            .map(node => acceptedById.get(node.id)?.reason)
            .find(Boolean);
        groups.push({
            charId: keep.charId,
            content: duplicateContentKey(keep.content),
            keep,
            duplicates,
            nodes: [keep, ...duplicates],
            aiReason: reason || candidateReason || undefined,
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

export function buildAiMergedMemoryDraftFromResponse(
    nodes: MemoryNode[],
    rawResponse: unknown,
): AiMergedMemoryDraft {
    if (nodes.length === 0) throw new Error('合并整理需要至少一条记忆');
    const parsed = rawResponse && typeof rawResponse === 'object'
        ? rawResponse as Record<string, unknown>
        : {};
    const content = typeof parsed.content === 'string'
        ? duplicateContentKey(parsed.content)
        : '';
    if (!content) throw new Error('AI 没有返回合并后的记忆正文');

    const fallback = nodes.slice().sort(compareCanonicalNode)[0];
    const maxImportance = Math.max(...nodes.map(node => node.importance || 1));
    const fallbackTags = nodes.flatMap(node => node.tags || []);
    const tags = uniqueTags(Array.isArray(parsed.tags) ? parsed.tags : [], fallbackTags);
    const mood = typeof parsed.mood === 'string' && parsed.mood.trim()
        ? parsed.mood.trim()
        : (fallback.mood || 'neutral');
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

    return {
        content,
        room: resolveMemoryRoom(parsed.room, fallback.room),
        tags,
        importance: clampImportance(parsed.importance, maxImportance),
        mood,
        reason: reason || undefined,
        sourceIds: nodes.map(node => node.id),
    };
}

export async function mergeMemoryNodesWithAi(
    nodes: MemoryNode[],
    llmConfig: AiDuplicateLLMConfig,
    options: { charName?: string } = {},
): Promise<AiMergedMemoryDraft> {
    if (nodes.length < 2) throw new Error('至少选择两条记忆才能合并整理');
    if (!llmConfig?.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
        throw new Error('合并整理需要完整的 baseUrl、apiKey 和 model');
    }
    const charId = nodes[0].charId;
    if (!nodes.every(node => node.charId === charId)) {
        throw new Error('只能合并同一角色的记忆');
    }

    const payload = nodes.map(node => ({
        id: node.id,
        content: clipForAi(node.content),
        room: node.room,
        tags: node.tags || [],
        importance: node.importance,
        mood: node.mood,
        createdAt: node.createdAt,
    }));

    const systemPrompt = `你是记忆宫殿的"合并整理员"。
用户会给你同一角色的几条相似记忆。你的任务不是判断删除，而是生成一条新的合并记忆：
- 重复表达只保留一次。
- 不同细节必须全部保留。
- 如果某条没有重复，也要把它的信息写进新记忆。
- 不要编造新事实，不要改变人称和关系。
- 输出应该是一条自然、完整、可直接存入记忆宫殿的记忆。

返回严格 JSON，不要 Markdown：
{
  "content": "合并后的新记忆正文",
  "room": "living_room|bedroom|study|user_room|self_room|attic|windowsill",
  "tags": ["标签"],
  "importance": 1,
  "mood": "情绪标签",
  "reason": "简单说明去掉了哪些重复、保留了哪些细节"
}`;

    const userPrompt = `角色：${options.charName || charId}
待合并记忆 JSON：
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
                temperature: 0.2,
                max_tokens: 3000,
                stream: false,
            }),
        },
        1,
        180_000,
        { appName: '记忆宫殿', purpose: 'AI记忆合并整理', characterId: charId },
    );

    const reply = data.choices?.[0]?.message?.content || '';
    const parsed = extractJson(reply);
    if (!parsed) throw new Error(`AI 没有返回可解析的合并 JSON：${reply.slice(0, 160)}`);
    return buildAiMergedMemoryDraftFromResponse(nodes, parsed);
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

    const systemPrompt = `你是记忆宫殿维护工具里的"误删拦截审核员"，不是整理员。
你的目标是保护有用记忆：宁可漏掉重复，也不要把有新信息的记忆列为可删。

判定标准：
1. 只有在 duplicate 的全部原子信息都已经被 keep 覆盖时，才允许 verdict="exact_duplicate"。
2. 只要 duplicate 比 keep 多出任何新事实、新时间点、因果、承诺、计划、偏好细节、情绪强度、关系变化、对象/地点/数量/条件，就不要列入 duplicates。
3. "主题相似"、"大体意思接近"、"可以互相补充"、"一个是另一个的进展/解释/例子"都不是重复。
4. 如果两条互相补充，应该返回空组；不要尝试合并。
5. 不要把明显更长、更有细节的记忆放进 duplicates；如果短句和长句重复，只能保留长句、删除短句。
6. 只能使用用户提供的 id，不要发明 id。跨角色重复不在本次任务中考虑。

返回严格 JSON，不要 Markdown，不要解释。格式：
{
  "groups": [
    {
      "keepId": "内容最完整、最适合保留的记忆 id",
      "reason": "整组为什么是零信息损失的完全重复",
      "duplicates": [
        {
          "id": "建议删除的重复记忆 id",
          "verdict": "exact_duplicate",
          "confidence": 0.0,
          "reason": "这条和 keep 完全相同的具体理由",
          "lostIfDeleted": []
        }
      ]
    }
  ]
}
规则：
- duplicates 里的每一项必须 verdict="exact_duplicate"。
- confidence 必须是 0 到 1 的数字；低于 0.92 的不要返回。
- lostIfDeleted 必须是空数组 []；只要能写出任何会丢失的点，就不要返回这条。
- 没有完全重复时返回 {"groups":[]}`;

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
        const preview = buildAiDuplicatePreviewFromSuggestions(charNodes, raw, {
            minConfidence: options.minConfidence,
        });
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
