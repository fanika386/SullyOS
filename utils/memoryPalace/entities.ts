/**
 * 轻量实体抽取（Mem0 实体信号的本地版 v1）
 *
 * 不依赖 LLM，纯本地规则，刻意保守：
 *  - 引号包裹的短语（「」『』“”""）→ 一个实体
 *  - 连续拉丁字母/数字词（≥2 字符，如 OpenAI / iPhone / SullyOS）→ 一个实体
 *  - 调用方提供的已知词/标签（如记忆 tags）→ 出现即实体
 *
 * 中文普通词不抽（避免把每个词都当实体刷分）；「TA」等高频短词也在停用表里。
 */

const LATIN_STOP_WORDS = new Set([
    'ta', 'ai', 'ok', 'id', 'it', 'is', 'in', 'on', 'at', 'to', 'be', 'me', 'my',
    'he', 'she', 'we', 'us', 'you', 'the', 'and', 'or', 'of', 'for', 'with', 'so',
    'do', 'go', 'no', 'up', 'down', 'as', 'by', 'if', 'but', 'not', 'can', 'will',
    'just', 'like', 'want', 'say', 'said', 'very', 'about',
]);

function normalizeEntity(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

/**
 * 从文本里抽取实体。knownTokens 里的词只要在文本中出现也会算实体（例如记忆 tags）。
 */
export function extractEntities(
    text: string,
    knownTokens: string[] = [],
): string[] {
    if (!text) return [];
    const out = new Set<string>();

    // 引号短语：「...」『...』“...”"..."（成对引号，内容 1-40 字）
    const quotedPattern = /[「『“"][^」』”"]{1,40}[」』”"]/g;
    for (const match of text.match(quotedPattern) ?? []) {
        const inner = normalizeEntity(match.slice(1, -1));
        if (inner) out.add(inner);
    }

    // 拉丁字母/数字词（首字符必须是字母），统一小写；过滤高频短词
    const latinPattern = /[A-Za-z][A-Za-z0-9_-]{1,}/g;
    for (const match of text.match(latinPattern) ?? []) {
        const token = match.toLowerCase();
        if (!LATIN_STOP_WORDS.has(token)) out.add(token);
    }

    // 已知词（标签 / 角色名等）：整词出现即算实体
    for (const token of knownTokens) {
        const normalized = normalizeEntity(token);
        if (normalized && text.includes(normalized)) out.add(normalized);
    }

    return Array.from(out);
}

/**
 * 查询与记忆之间的实体重叠加成：0..1。
 * 每共享一个实体 +0.25，四条封顶；没有共享则为 0。
 */
export function entityOverlapBonus(
    queryEntities: string[],
    memoryEntities: string[],
): number {
    if (queryEntities.length === 0 || memoryEntities.length === 0) return 0;
    const memorySet = new Set(memoryEntities);
    const shared = queryEntities.filter(entity => memorySet.has(entity)).length;
    if (shared === 0) return 0;
    return Math.min(1, shared * 0.25);
}
