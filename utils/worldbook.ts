import type {
    MountedWorldbook,
    Worldbook,
    WorldbookDepthRole,
    WorldbookPosition,
    WorldbookSelectiveLogic,
} from '../types';
import { extractContent, extractJson, safeResponseJson } from './safeApi';

export type WorldbookLike = Worldbook | MountedWorldbook;

export interface WorldbookScanMessage {
    role?: string;
    content: unknown;
}

export interface ResolvedWorldbookEntry {
    book: WorldbookLike;
    content: string;
    position: WorldbookPosition;
    order: number;
}

export interface WorldbookSystemSections {
    beforeCharacter: ResolvedWorldbookEntry[];
    afterCharacter: ResolvedWorldbookEntry[];
    authorsNoteTop: ResolvedWorldbookEntry[];
    authorsNoteBottom: ResolvedWorldbookEntry[];
    atDepth: ResolvedWorldbookEntry[];
    beforeExamples: ResolvedWorldbookEntry[];
    afterExamples: ResolvedWorldbookEntry[];
}

export type WorldbookDuplicateSeverity = 'exact' | 'high' | 'medium' | 'low';

export interface WorldbookDuplicateBookRef {
    id: string;
    title: string;
    category?: string;
}

export interface WorldbookDuplicateEvidence {
    sourceText: string;
    targetText: string;
    similarity: number;
}

export interface WorldbookDuplicateFinding {
    id: string;
    bookA: WorldbookDuplicateBookRef;
    bookB: WorldbookDuplicateBookRef;
    duplicateRate: number;
    severity: WorldbookDuplicateSeverity;
    verdict: string;
    reasons: string[];
    suggestions: string[];
    sharedKeywords: string[];
    evidence: WorldbookDuplicateEvidence[];
}

export interface WorldbookDuplicateAnalysis {
    selectedCount: number;
    comparedPairs: number;
    duplicatePairs: number;
    highestDuplicateRate: number;
    findings: WorldbookDuplicateFinding[];
    cleanBookIds: string[];
}

export interface WorldbookDuplicateOptions {
    /** Minimum duplicate rate, from 0 to 100, required for a pair to appear in findings. */
    minDuplicateRate?: number;
    maxFindings?: number;
}

export type WorldbookDuplicateAiRelation = 'duplicate' | 'overlap' | 'complementary' | 'conflict' | 'unrelated';

export interface WorldbookDedupeAiApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature?: number;
}

export interface WorldbookDedupeAiApiPresetLike {
    id: string;
    name: string;
    config: {
        baseUrl?: string;
        apiKey?: string;
        model?: string;
        temperature?: number;
    };
}

export interface WorldbookDedupeAiApiChoice {
    id: string;
    label: string;
    helperText: string;
    api: WorldbookDedupeAiApiConfig;
    configured: boolean;
}

export interface BuildWorldbookDedupeAiApiChoicesInput {
    chatApi: WorldbookDedupeAiApiConfig;
    presets?: WorldbookDedupeAiApiPresetLike[];
    availableModels?: string[];
    selectedChoiceId?: string;
}

export interface WorldbookDuplicateAiReview {
    findingId: string;
    bookIds?: string[];
    bookTitles?: string[];
    relation: WorldbookDuplicateAiRelation;
    functionalOverlap: number;
    verdict: string;
    functionCategory?: string;
    reason?: string;
    benefit?: string;
    mergeAdvice: string[];
    keepAdvice?: string;
    needsHumanReview: string[];
}

export interface WorldbookDuplicateAiResult {
    model: string;
    reviewedAt: number;
    reviews: WorldbookDuplicateAiReview[];
    rawText: string;
}

export interface ReviewWorldbookDuplicatesWithAIInput {
    api: WorldbookDedupeAiApiConfig;
    books: WorldbookLike[];
    analysis: WorldbookDuplicateAnalysis;
    maxPairs?: number;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface ReviewSelectedWorldbooksWithAIInput {
    api: WorldbookDedupeAiApiConfig;
    books: WorldbookLike[];
    maxBooks?: number;
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export const WORLDBOOK_POSITION_LABELS: Record<WorldbookPosition, string> = {
    0: '角色设定前',
    1: '角色设定后',
    2: '作者注释顶部',
    3: '作者注释底部',
    4: '聊天记录指定深度',
    5: '示例消息前',
    6: '示例消息后',
};

export const WORLDBOOK_POSITION_DESCRIPTIONS: Record<WorldbookPosition, string> = {
    0: '适合放全局规则、基础背景；会出现在角色身份与性格设定之前。',
    1: '适合一般世界观、人物与地点设定；这是旧版世界书一直使用的默认位置。',
    2: '适合放写作方向、语气或节奏要求；位于作者注释内容顶部。',
    3: '适合放作者注释后的补充与强调；比顶部内容更靠后。',
    4: '适合临时状态、近期事件或强提醒；按深度和角色插入聊天记录。',
    5: '适合放阅读示例对话前需要先知道的说明。',
    6: '适合放示例对话结束后的补充说明。',
};

export const WORLDBOOK_ROLE_LABELS: Record<WorldbookDepthRole, string> = {
    0: 'System',
    1: 'User',
    2: 'Assistant',
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const asStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map(item => String(item).trim()).filter(Boolean);
};

const trimDedupeApiConfig = (
    api: Partial<WorldbookDedupeAiApiConfig>,
    fallback?: Partial<WorldbookDedupeAiApiConfig>,
): WorldbookDedupeAiApiConfig => ({
    baseUrl: String(api.baseUrl || fallback?.baseUrl || '').trim(),
    apiKey: String(api.apiKey || fallback?.apiKey || '').trim(),
    model: String(api.model || fallback?.model || '').trim(),
    temperature: clamp(api.temperature ?? fallback?.temperature, 0, 2, 0.1),
});

const isDedupeApiConfigured = (api: WorldbookDedupeAiApiConfig): boolean => (
    Boolean(api.baseUrl && api.apiKey && api.model)
);

export const buildWorldbookDedupeAiApiChoices = ({
    chatApi,
    presets = [],
    availableModels = [],
    selectedChoiceId,
}: BuildWorldbookDedupeAiApiChoicesInput): { options: WorldbookDedupeAiApiChoice[]; selected: WorldbookDedupeAiApiChoice } => {
    const chat = trimDedupeApiConfig(chatApi);
    const options: WorldbookDedupeAiApiChoice[] = [{
        id: 'chat',
        label: chat.model ? `当前 API：${chat.model}` : '当前 API（未配置模型）',
        helperText: '跟随聊天 API 当前配置的模型；想换模型可直接在下拉里选其它模型或预设。',
        api: chat,
        configured: isDedupeApiConfigured(chat),
    }];

    const seenModels = new Set<string>();
    availableModels.forEach(model => {
        const trimmed = String(model || '').trim();
        if (!trimmed || seenModels.has(trimmed)) return;
        seenModels.add(trimmed);
        const api = { ...chat, model: trimmed };
        options.push({
            id: `chat:${trimmed}`,
            label: `聊天 API · ${trimmed}`,
            helperText: '使用聊天 API 的地址和 Key，只把这次深检的模型换成这个。',
            api,
            configured: isDedupeApiConfigured(api),
        });
    });

    presets.forEach(preset => {
        const api = trimDedupeApiConfig(preset.config);
        options.push({
            id: `preset:${preset.id}`,
            label: `预设：${preset.name || preset.id}${api.model ? ` · ${api.model}` : ''}`,
            helperText: '使用这个预设的完整 API 配置（URL / Key / 模型）做这次深检。',
            api,
            configured: isDedupeApiConfigured(api),
        });
    });

    const preferredId = selectedChoiceId || 'chat';
    let selected = options.find(option => option.id === preferredId);
    // 之前保存过“聊天 API + 具体模型”，这次模型列表里暂时没有它时也保留该选项，
    // 避免静默跳回默认模型。
    if (!selected && preferredId.startsWith('chat:')) {
        const model = preferredId.slice('chat:'.length);
        if (model) {
            const api = { ...chat, model };
            options.push({
                id: preferredId,
                label: `聊天 API · ${model}`,
                helperText: '使用聊天 API 的地址和 Key，只把这次深检的模型换成这个。',
                api,
                configured: isDedupeApiConfigured(api),
            });
            selected = options[options.length - 1];
        }
    }
    if (!selected) selected = options[0];
    return { options, selected };
};

export const splitWorldbookKeywords = (value: string): string[] => (
    value.split(/[,，\n]/).map(item => item.trim()).filter(Boolean)
);

export const toMountedWorldbook = (book: Worldbook): MountedWorldbook => ({
    id: book.id,
    title: book.title,
    content: book.content,
    category: book.category,
    key: book.key ? [...book.key] : undefined,
    keysecondary: book.keysecondary ? [...book.keysecondary] : undefined,
    constant: book.constant,
    selective: book.selective,
    selectiveLogic: book.selectiveLogic,
    order: book.order,
    position: book.position,
    disable: book.disable,
    probability: book.probability,
    useProbability: book.useProbability,
    depth: book.depth,
    role: book.role,
    scanDepth: book.scanDepth,
    caseSensitive: book.caseSensitive,
    matchWholeWords: book.matchWholeWords,
    sourceUid: book.sourceUid,
});

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const keywordMatches = (
    text: string,
    keyword: string,
    caseSensitive: boolean,
    wholeWords: boolean,
): boolean => {
    if (!keyword) return false;
    if (!wholeWords) {
        return caseSensitive
            ? text.includes(keyword)
            : text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
    }
    const flags = caseSensitive ? 'u' : 'iu';
    const escaped = escapeRegExp(keyword);
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, flags).test(text);
};

const messageText = (message: WorldbookScanMessage): string => {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
        return message.content
            .map(part => (typeof part === 'string' ? part : (part as any)?.text || ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
};

const scanTextForBook = (book: WorldbookLike, messages: WorldbookScanMessage[]): string => {
    const depth = Math.max(0, Math.floor(book.scanDepth ?? 4));
    if (depth === 0) return '';
    return messages.slice(-depth).map(messageText).filter(Boolean).join('\n');
};

const secondaryConditionPasses = (
    book: WorldbookLike,
    text: string,
    caseSensitive: boolean,
    wholeWords: boolean,
): boolean => {
    if (!book.selective) return true;
    const secondary = book.keysecondary || [];
    if (secondary.length === 0) return true;
    const matches = secondary.map(key => keywordMatches(text, key, caseSensitive, wholeWords));
    const logic: WorldbookSelectiveLogic = book.selectiveLogic ?? 0;
    if (logic === 1) return !matches.every(Boolean);
    if (logic === 2) return !matches.some(Boolean);
    if (logic === 3) return matches.every(Boolean);
    return matches.some(Boolean);
};

export const isWorldbookEntryActive = (
    book: WorldbookLike,
    messages: WorldbookScanMessage[] = [],
): boolean => {
    if (book.disable) return false;

    const primary = book.key || [];
    const isConstant = book.constant ?? primary.length === 0;
    const text = scanTextForBook(book, messages);
    const caseSensitive = book.caseSensitive === true;
    const wholeWords = book.matchWholeWords === true;

    if (!isConstant) {
        if (primary.length === 0) return false;
        if (!primary.some(key => keywordMatches(text, key, caseSensitive, wholeWords))) return false;
        if (!secondaryConditionPasses(book, text, caseSensitive, wholeWords)) return false;
    }

    if (book.useProbability) {
        const probability = clamp(book.probability, 0, 100, 100);
        if (probability <= 0) return false;
        if (probability < 100 && Math.random() * 100 >= probability) return false;
    }

    return true;
};

export const expandWorldbookMacros = (content: string, charName: string, userName: string): string => {
    let expanded = content;
    if (charName) expanded = expanded.replace(/{{\s*char\s*}}/gi, charName);
    if (userName) expanded = expanded.replace(/{{\s*user\s*}}/gi, userName);
    return expanded;
};

export const resolveWorldbookEntries = (
    books: WorldbookLike[] = [],
    messages: WorldbookScanMessage[] = [],
    charName = '',
    userName = '',
): ResolvedWorldbookEntry[] => books
    .filter(book => isWorldbookEntryActive(book, messages))
    .map(book => ({
        book,
        content: expandWorldbookMacros(book.content || '', charName, userName),
        position: book.position ?? 1,
        order: Number.isFinite(book.order) ? Number(book.order) : 100,
    }))
    .filter(entry => entry.content.trim())
    .sort((a, b) => a.order - b.order);

export const splitWorldbookSections = (entries: ResolvedWorldbookEntry[]): WorldbookSystemSections => ({
    beforeCharacter: entries.filter(entry => entry.position === 0),
    afterCharacter: entries.filter(entry => entry.position === 1),
    authorsNoteTop: entries.filter(entry => entry.position === 2),
    authorsNoteBottom: entries.filter(entry => entry.position === 3),
    atDepth: entries.filter(entry => entry.position === 4),
    beforeExamples: entries.filter(entry => entry.position === 5),
    afterExamples: entries.filter(entry => entry.position === 6),
});

export const formatWorldbookSection = (
    entries: ResolvedWorldbookEntry[],
    heading: string,
): string => {
    if (entries.length === 0) return '';
    let output = `### ${heading}\n`;
    let lastLegacyCategory = '';
    for (const entry of entries) {
        // SillyTavern comments are editor-only and are not part of the prompt.
        if (entry.book.sourceUid === undefined) {
            const category = entry.book.category || '通用设定 (General)';
            if (category !== lastLegacyCategory) {
                output += `#### [${category}]\n`;
                lastLegacyCategory = category;
            }
            output += `**Title: ${entry.book.title}**\n`;
        }
        output += `${entry.content.trim()}\n---\n`;
    }
    return `${output}\n`;
};

export const injectWorldbookDepthEntries = <T extends WorldbookScanMessage>(
    messages: T[],
    entries: ResolvedWorldbookEntry[],
): Array<T | { role: string; content: string }> => {
    if (entries.length === 0) return [...messages];
    const buckets = new Map<number, ResolvedWorldbookEntry[]>();
    for (const entry of entries) {
        const depth = Math.max(0, Math.floor(entry.book.depth ?? 4));
        const index = Math.max(0, messages.length - depth);
        const bucket = buckets.get(index) || [];
        bucket.push(entry);
        buckets.set(index, bucket);
    }

    const result: Array<T | { role: string; content: string }> = [];
    for (let index = 0; index <= messages.length; index += 1) {
        const bucket = buckets.get(index) || [];
        for (const entry of bucket) {
            const roleValue = entry.book.role ?? 0;
            const role = roleValue === 1 ? 'user' : roleValue === 2 ? 'assistant' : 'system';
            result.push({ role, content: entry.content.trim() });
        }
        if (index < messages.length) result.push(messages[index]);
    }
    return result;
};

const COMPARISON_MAX_TEXT_CHARS = 20000;
const COMPARISON_MAX_PASSAGES = 64;
const DEFAULT_DUPLICATE_RATE_THRESHOLD = 35;

interface ComparablePassage {
    text: string;
    normalized: string;
    tokens: Set<string>;
}

interface PreparedComparableWorldbook {
    ref: WorldbookDuplicateBookRef;
    normalizedContent: string;
    contentTokens: Set<string>;
    titleTokens: Set<string>;
    keywordTokens: Set<string>;
    keywordLabels: Map<string, string>;
    passages: ComparablePassage[];
}

const normalizeComparableText = (value: unknown): string => String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~[\](){}|\\/"'“”‘’]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const makeTextExcerpt = (value: string, maxLength = 110): string => {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (compact.length <= maxLength) return compact;
    return `${compact.slice(0, maxLength - 1)}…`;
};

const CJK_STOP_CHARS = new Set([
    '的', '了', '是', '在', '和', '与', '或', '及', '并', '把', '被', '会', '有',
    '为', '以', '于', '中', '上', '下', '里', '内', '外', '这', '那', '他', '她',
    '它', '你', '我', '们', '个', '条', '本', '种',
]);

const addCjkNgrams = (tokens: Set<string>, chunk: string): void => {
    const chars = Array.from(chunk);
    if (chars.length === 1) {
        tokens.add(chars[0]);
        return;
    }
    chars.forEach(char => {
        if (!CJK_STOP_CHARS.has(char)) tokens.add(char);
    });
    for (let size = 2; size <= 3; size += 1) {
        if (chars.length < size) continue;
        for (let index = 0; index <= chars.length - size; index += 1) {
            tokens.add(chars.slice(index, index + size).join(''));
        }
    }
};

const comparableTokens = (value: string): Set<string> => {
    const normalized = normalizeComparableText(value);
    const tokens = new Set<string>();
    for (const word of normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) || []) {
        tokens.add(word);
    }
    for (const chunk of normalized.match(/[\u3400-\u9FFF]+/g) || []) {
        addCjkNgrams(tokens, chunk);
    }
    return tokens;
};

const setIntersectionSize = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 || b.size === 0) return 0;
    let count = 0;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    small.forEach(item => {
        if (large.has(item)) count += 1;
    });
    return count;
};

const diceSimilarity = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 || b.size === 0) return 0;
    return (2 * setIntersectionSize(a, b)) / (a.size + b.size);
};

const jaccardSimilarity = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 || b.size === 0) return 0;
    const intersection = setIntersectionSize(a, b);
    return intersection / (a.size + b.size - intersection);
};

const splitComparablePassages = (content: string): ComparablePassage[] => {
    const rawPassages = content
        .slice(0, COMPARISON_MAX_TEXT_CHARS)
        .split(/[\n\r]+/)
        .flatMap(line => {
            const parts: string[] = [];
            let acc = '';
            for (const ch of line) {
                acc += ch;
                if ('。！？!?；;'.includes(ch)) {
                    parts.push(acc);
                    acc = '';
                }
            }
            if (acc) parts.push(acc);
            return parts;
        })
        .map(item => item.trim())
        .filter(item => normalizeComparableText(item).length >= 8)
        .slice(0, COMPARISON_MAX_PASSAGES);

    const passages = rawPassages.length > 0 ? rawPassages : [content.trim()].filter(Boolean);
    return passages.map(text => ({
        text,
        normalized: normalizeComparableText(text),
        tokens: comparableTokens(text),
    }));
};

const keywordTokenMap = (book: WorldbookLike): { tokens: Set<string>; labels: Map<string, string> } => {
    const labels = new Map<string, string>();
    const tokens = new Set<string>();
    const rawKeywords = [...(book.key || []), ...(book.keysecondary || [])];
    rawKeywords.forEach(keyword => {
        const normalized = normalizeComparableText(keyword);
        if (!normalized) return;
        tokens.add(normalized);
        if (!labels.has(normalized)) labels.set(normalized, keyword.trim());
    });
    return { tokens, labels };
};

const prepareComparableWorldbook = (book: WorldbookLike): PreparedComparableWorldbook => {
    const { tokens: keywordTokens, labels: keywordLabels } = keywordTokenMap(book);
    return {
        ref: {
            id: book.id,
            title: book.title,
            category: book.category,
        },
        normalizedContent: normalizeComparableText(String(book.content || '').slice(0, COMPARISON_MAX_TEXT_CHARS)),
        contentTokens: comparableTokens(String(book.content || '').slice(0, COMPARISON_MAX_TEXT_CHARS)),
        titleTokens: comparableTokens(book.title || ''),
        keywordTokens,
        keywordLabels,
        passages: splitComparablePassages(book.content || ''),
    };
};

const containmentSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const minLength = Math.min(a.length, b.length);
    const maxLength = Math.max(a.length, b.length);
    if (minLength < 32) return 0;
    if (!a.includes(b) && !b.includes(a)) return 0;
    return clamp01(0.78 + (minLength / maxLength) * 0.2);
};

const findPassageEvidence = (
    a: PreparedComparableWorldbook,
    b: PreparedComparableWorldbook,
): { score: number; evidence: WorldbookDuplicateEvidence[] } => {
    const candidates: WorldbookDuplicateEvidence[] = [];
    for (const passageA of a.passages) {
        for (const passageB of b.passages) {
            let similarity = diceSimilarity(passageA.tokens, passageB.tokens);
            if (passageA.normalized && passageA.normalized === passageB.normalized) {
                similarity = 1;
            } else if (
                passageA.normalized.length >= 16 &&
                passageB.normalized.length >= 16 &&
                (passageA.normalized.includes(passageB.normalized) || passageB.normalized.includes(passageA.normalized))
            ) {
                similarity = Math.max(similarity, containmentSimilarity(passageA.normalized, passageB.normalized));
            }
            if (similarity >= 0.42) {
                candidates.push({
                    sourceText: makeTextExcerpt(passageA.text),
                    targetText: makeTextExcerpt(passageB.text),
                    similarity: Math.round(similarity * 100),
                });
            }
        }
    }

    const usedSource = new Set<string>();
    const usedTarget = new Set<string>();
    const evidence = candidates
        .sort((left, right) => right.similarity - left.similarity)
        .filter(item => {
            const keyA = item.sourceText;
            const keyB = item.targetText;
            if (usedSource.has(keyA) || usedTarget.has(keyB)) return false;
            usedSource.add(keyA);
            usedTarget.add(keyB);
            return true;
        })
        .slice(0, 3);

    if (evidence.length === 0) return { score: 0, evidence };
    const score = evidence.reduce((sum, item, index) => sum + (item.similarity / 100) * (index === 0 ? 0.7 : 0.15), 0);
    return { score: clamp01(score), evidence };
};

const sharedKeywordLabels = (a: PreparedComparableWorldbook, b: PreparedComparableWorldbook): string[] => {
    const shared: string[] = [];
    a.keywordTokens.forEach(token => {
        if (b.keywordTokens.has(token)) {
            shared.push(a.keywordLabels.get(token) || b.keywordLabels.get(token) || token);
        }
    });
    return shared;
};

const duplicateSeverity = (rate: number, exact: boolean): WorldbookDuplicateSeverity => {
    if (exact) return 'exact';
    if (rate >= 82) return 'high';
    if (rate >= 62) return 'medium';
    return 'low';
};

const duplicateVerdict = (severity: WorldbookDuplicateSeverity): string => {
    if (severity === 'exact') return '内容几乎完全重复';
    if (severity === 'high') return '高度重复，建议合并';
    if (severity === 'medium') return '疑似重复，需要人工确认';
    return '轻度重叠，建议只整理共同事实';
};

const duplicateSuggestions = (
    severity: WorldbookDuplicateSeverity,
    a: PreparedComparableWorldbook,
    b: PreparedComparableWorldbook,
): string[] => {
    const longer = a.normalizedContent.length >= b.normalizedContent.length ? a.ref.title : b.ref.title;
    if (severity === 'exact') {
        return [
            `两条内容基本一致，建议保留「${longer}」作为主条目，把另一条的标题、关键词或挂载关系检查后再合并。`,
            '合并前先确认两条的触发关键词、注入位置和启用状态是否有差异。',
        ];
    }
    if (severity === 'high') {
        return [
            `建议以「${longer}」为主条目，把重复段落压缩成一版，另一条只保留独有信息。`,
            '如果两条挂在不同角色上，先把共同世界观抽成通用条目，再把角色私有细节留在各自条目。',
        ];
    }
    if (severity === 'medium') {
        return [
            '建议逐段比对证据片段：共同事实合并，视角、时间线或角色限定信息分开保留。',
            '标题和关键词可以改得更明确，避免聊天时同时触发两条相近设定。',
        ];
    }
    return [
        '只发现轻度重叠，不建议直接删除；可以把共同名词、地点或规则统一写法。',
        '如果这是同一主题的不同侧面，可以通过分组和标题区分用途。',
    ];
};

const comparePreparedWorldbooks = (
    a: PreparedComparableWorldbook,
    b: PreparedComparableWorldbook,
): Omit<WorldbookDuplicateFinding, 'id' | 'bookA' | 'bookB'> & { rawScore: number } => {
    const exact = !!a.normalizedContent && a.normalizedContent === b.normalizedContent;
    const contentScore = diceSimilarity(a.contentTokens, b.contentTokens);
    const sharedContentTokens = setIntersectionSize(a.contentTokens, b.contentTokens);
    const titleScore = diceSimilarity(a.titleTokens, b.titleTokens);
    const keywordScore = jaccardSimilarity(a.keywordTokens, b.keywordTokens);
    const containmentScore = containmentSimilarity(a.normalizedContent, b.normalizedContent);
    const { score: passageScore, evidence } = findPassageEvidence(a, b);
    const sharedKeywords = sharedKeywordLabels(a, b);
    const sameCategory = !!a.ref.category && a.ref.category === b.ref.category;

    let rawScore = exact
        ? 1
        : Math.max(
            containmentScore,
            contentScore * 0.6 + passageScore * 0.34 + keywordScore * 0.06,
            passageScore * 0.72 + contentScore * 0.2 + keywordScore * 0.08,
        );
    if (keywordScore > 0) rawScore += Math.min(0.08, keywordScore * 0.08);
    if (titleScore > 0) rawScore += Math.min(0.05, titleScore * 0.05);
    if (sharedContentTokens >= 8) rawScore += Math.min(0.18, (sharedContentTokens - 7) * 0.012);
    if (sameCategory) rawScore += 0.02;
    rawScore = clamp01(rawScore);

    const duplicateRate = Math.round(rawScore * 100);
    const severity = duplicateSeverity(duplicateRate, exact);
    const reasons: string[] = [];
    if (exact) reasons.push('正文归一化后完全一致');
    if (contentScore >= 0.35) reasons.push(`正文词片相似度 ${Math.round(contentScore * 100)}%`);
    if (passageScore >= 0.35) reasons.push(`命中相近片段 ${Math.round(passageScore * 100)}%`);
    if (sharedContentTokens >= 8) reasons.push(`共享核心词片 ${sharedContentTokens} 个`);
    if (sharedKeywords.length > 0) reasons.push(`共享关键词：${sharedKeywords.join('、')}`);
    if (sameCategory) reasons.push('位于同一分组');
    if (reasons.length === 0) reasons.push('文本结构存在轻度重合');

    return {
        rawScore,
        duplicateRate,
        severity,
        verdict: duplicateVerdict(severity),
        reasons,
        suggestions: duplicateSuggestions(severity, a, b),
        sharedKeywords,
        evidence,
    };
};

export const analyzeWorldbookDuplicates = (
    books: WorldbookLike[] = [],
    options: WorldbookDuplicateOptions = {},
): WorldbookDuplicateAnalysis => {
    const prepared = books
        .filter(book => book && book.id && (book.title || book.content))
        .map(prepareComparableWorldbook);
    const minDuplicateRate = clamp(options.minDuplicateRate, 0, 100, DEFAULT_DUPLICATE_RATE_THRESHOLD);
    const maxFindings = Math.max(1, Math.floor(options.maxFindings ?? 50));
    const findings: WorldbookDuplicateFinding[] = [];
    let comparedPairs = 0;
    let highestDuplicateRate = 0;

    for (let left = 0; left < prepared.length; left += 1) {
        for (let right = left + 1; right < prepared.length; right += 1) {
            comparedPairs += 1;
            const compared = comparePreparedWorldbooks(prepared[left], prepared[right]);
            highestDuplicateRate = Math.max(highestDuplicateRate, compared.duplicateRate);
            if (compared.duplicateRate >= minDuplicateRate) {
                findings.push({
                    id: `${prepared[left].ref.id}__${prepared[right].ref.id}`,
                    bookA: prepared[left].ref,
                    bookB: prepared[right].ref,
                    duplicateRate: compared.duplicateRate,
                    severity: compared.severity,
                    verdict: compared.verdict,
                    reasons: compared.reasons,
                    suggestions: compared.suggestions,
                    sharedKeywords: compared.sharedKeywords,
                    evidence: compared.evidence,
                });
            }
        }
    }

    const sortedFindings = findings
        .sort((left, right) => right.duplicateRate - left.duplicateRate)
        .slice(0, maxFindings);
    const duplicateBookIds = new Set<string>();
    sortedFindings.forEach(finding => {
        duplicateBookIds.add(finding.bookA.id);
        duplicateBookIds.add(finding.bookB.id);
    });

    return {
        selectedCount: prepared.length,
        comparedPairs,
        duplicatePairs: sortedFindings.length,
        highestDuplicateRate,
        findings: sortedFindings,
        cleanBookIds: prepared.map(item => item.ref.id).filter(id => !duplicateBookIds.has(id)),
    };
};

const WORLDBOOK_DEDUPE_AI_SYSTEM_PROMPT = [
    '你是世界书去重小助手，只判断候选世界书是不是在说同一件事。',
    '请用通俗、短句、直接的中文，像给普通用户写提示；不要写学术分析，不要堆专业术语。',
    '必须使用输入里的真实书名，不要用 Book A、Book B、A 书、B 书代替。',
    '目标是把世界书整理成以后方便挂给不同角色的条目：通用设定抽出来，角色私有内容分开留。',
    '把建议写成用户看得懂的操作：先按功能分类，再说明为什么建议这样改，以及这样改有什么好处。',
    '不要删除或自动改写用户内容，只输出给人工确认的简单建议。',
    '必须只返回 JSON，不要 Markdown，不要解释。',
].join('\n');

const normalizedAiRelation = (value: unknown): WorldbookDuplicateAiRelation => {
    const relation = String(value || '').trim().toLowerCase();
    if (relation === 'duplicate') return 'duplicate';
    if (relation === 'overlap') return 'overlap';
    if (relation === 'complementary') return 'complementary';
    if (relation === 'conflict') return 'conflict';
    if (relation === 'unrelated') return 'unrelated';
    return 'overlap';
};

const asReviewTextArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6);
    }
    const text = String(value || '').trim();
    return text ? [text] : [];
};

const excerptForAi = (value: string, maxLength = 900): string => makeTextExcerpt(value || '', maxLength);

interface WorldbookDedupeAiReviewContext {
    findingId: string;
    bookRefs: WorldbookDuplicateBookRef[];
    findings: WorldbookDuplicateFinding[];
    candidate: Record<string, unknown>;
}

const bookOrderIndex = (books: WorldbookLike[]): Map<string, number> => (
    new Map(books.map((book, index) => [book.id, index]))
);

const sortBookIdsByInputOrder = (bookIds: string[], order: Map<string, number>): string[] => (
    [...bookIds].sort((left, right) => (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right))
);

const buildWorldbookDedupeAiReviewContexts = (
    books: WorldbookLike[],
    findings: WorldbookDuplicateFinding[],
): WorldbookDedupeAiReviewContext[] => {
    const bookById = new Map(books.map(book => [book.id, book]));
    const order = bookOrderIndex(books);
    const adjacency = new Map<string, Set<string>>();
    const findingsByBookId = new Map<string, WorldbookDuplicateFinding[]>();
    findings.forEach(finding => {
        const left = finding.bookA.id;
        const right = finding.bookB.id;
        if (!adjacency.has(left)) adjacency.set(left, new Set());
        if (!adjacency.has(right)) adjacency.set(right, new Set());
        adjacency.get(left)?.add(right);
        adjacency.get(right)?.add(left);
        [left, right].forEach(id => {
            if (!findingsByBookId.has(id)) findingsByBookId.set(id, []);
            findingsByBookId.get(id)?.push(finding);
        });
    });

    const seen = new Set<string>();
    const seedIds = sortBookIdsByInputOrder(Array.from(adjacency.keys()), order);
    const bookPayload = (id: string) => {
        const book = bookById.get(id);
        return {
            id,
            title: book?.title || id,
            category: book?.category || '',
            keywords: [...(book?.key || []), ...(book?.keysecondary || [])].slice(0, 12),
            contentExcerpt: excerptForAi(book?.content || ''),
        };
    };
    const pairPayload = (finding: WorldbookDuplicateFinding) => ({
        pairId: finding.id,
        bookTitles: [finding.bookA.title, finding.bookB.title],
        localDuplicateRate: finding.duplicateRate,
        localVerdict: finding.verdict,
        localReasons: finding.reasons,
        sharedKeywords: finding.sharedKeywords,
        evidence: finding.evidence.map(item => ({
                sourceText: item.sourceText,
                targetText: item.targetText,
                similarity: item.similarity,
        })),
    });

    return seedIds.flatMap(seed => {
        if (seen.has(seed)) return [];
        const stack = [seed];
        const component = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            component.add(id);
            adjacency.get(id)?.forEach(next => {
                if (!seen.has(next)) stack.push(next);
            });
        }

        const bookIds = sortBookIdsByInputOrder(Array.from(component), order);
        const componentFindings = findings
            .filter(finding => component.has(finding.bookA.id) && component.has(finding.bookB.id))
            .sort((left, right) => right.duplicateRate - left.duplicateRate || left.id.localeCompare(right.id));
        if (bookIds.length < 2 || componentFindings.length === 0) return [];

        const findingId = bookIds.length === 2 ? componentFindings[0].id : `group:${bookIds.join('__')}`;
        const bookRefs = bookIds.map(id => {
            const firstFinding = findingsByBookId.get(id)?.[0];
            if (firstFinding?.bookA.id === id) return firstFinding.bookA;
            if (firstFinding?.bookB.id === id) return firstFinding.bookB;
            return { id, title: bookById.get(id)?.title || id, category: bookById.get(id)?.category };
        });
        return [{
            findingId,
            bookRefs,
            findings: componentFindings,
            candidate: {
                findingId,
                reviewMode: bookIds.length > 2 ? 'multi_book_group' : 'pair',
                bookCount: bookIds.length,
                books: bookIds.map(bookPayload),
                localPairs: componentFindings.map(pairPayload),
            },
        }];
    });
};

const buildWorldbookDedupeAiPrompt = (
    contexts: WorldbookDedupeAiReviewContext[],
): string => {
    const duplicateGroups = contexts.map(context => context.candidate);

    return JSON.stringify({
        task: 'review_worldbook_duplicate_groups',
        groupRule: '每个 duplicateGroups 项可能包含 2 本或更多本世界书；请按一组一起判断，不要拆成 Book A / Book B。',
        categoryRule: '请按功能分类，例如：通用世界观、角色专属设定、地点/组织设定、时间线/事件、触发关键词、写作规则/禁忌、其它。',
        cleanupGoal: '建议的目的不是炫技整理，而是让这些世界书以后无论挂给哪个角色都更方便、更清楚、更少重复。',
        duplicateGroups,
        outputSchema: {
            reviews: [{
                findingId: 'string，必须等于输入 duplicateGroups 的 findingId',
                bookTitles: ['可选：直接返回本组真实书名'],
                relation: 'duplicate | overlap | complementary | conflict | unrelated',
                functionalOverlap: '0-100，粗略判断这一组有多像',
                verdict: '一句通俗中文结论，必须写真实书名，例如：「月城设定」和「月城历史」主要在说同一件事，可以合在一起。',
                functionCategory: '这组主要属于什么功能，例如：通用世界观 / 角色专属设定 / 地点或组织 / 时间线事件 / 触发关键词 / 写作规则',
                reason: '为什么建议这样改，用一句简单中文说明问题在哪里',
                benefit: '这样改有什么好处，重点说明以后挂给不同角色会更方便、更清楚或更省提示词',
                mergeAdvice: ['短句建议：用真实书名说明怎么合并、删哪句、保留哪条、标题或关键词怎么改'],
                keepAdvice: '可选：用简单话说明哪条更适合保留',
                needsHumanReview: ['还拿不准、需要用户自己确认的小问题'],
            }],
        },
        writingStyle: [
            '这是粗略扫重和修复建议，不是最终判定。',
            '不用写学术分析，也不要使用“功能覆盖”“语义一致性”等专业说法。',
            '不要说 Book A、Book B、Book C；用户看多本世界书时分不清，请直接说书名。',
            '每组都要写清楚：按功能分类、为什么建议这样改、这样改有什么好处。',
            '优先输出短句，每条建议尽量 30 个中文字符以内。',
        ],
    }, null, 2);
};

const buildDirectWorldbookDedupeAiPrompt = (
    books: WorldbookLike[],
): string => JSON.stringify({
    task: 'direct_review_selected_worldbooks',
    reviewRule: '请直接阅读 selectedBooks 的正文，找出意思重复、明显重叠、互补或冲突的世界书组；不要依赖本地重复率。',
    selectedBooks: books.map(book => ({
        id: book.id,
        title: book.title,
        category: book.category || '',
        keywords: [...(book.key || []), ...(book.keysecondary || [])].slice(0, 12),
        contentExcerpt: excerptForAi(book.content || ''),
    })),
    outputSchema: {
        reviews: [{
            bookIds: ['必须使用 selectedBooks 里的真实 id，至少 2 个'],
            bookTitles: ['可选：直接返回真实书名'],
            relation: 'duplicate | overlap | complementary | conflict | unrelated',
            functionalOverlap: '0-100，粗略判断这一组有多像',
            verdict: '一句通俗中文结论，必须写真实书名',
            mergeAdvice: ['短句建议：怎么合并、删哪句、保留哪条、标题或关键词怎么改'],
            keepAdvice: '可选：用简单话说明哪条更适合保留',
            needsHumanReview: ['还拿不准、需要用户自己确认的小问题'],
        }],
    },
    writingStyle: [
        '这是 AI 直接深度检查，不是本地快速检测。',
        '如果没有值得处理的重复或重叠，返回 {"reviews":[]}',
        '不要说 Book A、Book B、Book C；请直接说书名。',
        '优先输出短句，每条建议尽量 30 个中文字符以内。',
    ],
}, null, 2);

const replaceAiBookAliasesWithTitles = (value: string, context?: WorldbookDedupeAiReviewContext): string => {
    if (!value || !context) return value;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return context.bookRefs.reduce((text, book, index) => {
        const letter = letters[index];
        if (!letter) return text;
        const title = `「${book.title}」`;
        return text
            .replace(new RegExp(`\\b[Bb]ook\\s*${letter}\\b`, 'g'), title)
            .replace(new RegExp(`书本\\s*${letter}|书本${letter}|世界书\\s*${letter}|世界书${letter}|条目\\s*${letter}|条目${letter}|${letter}\\s*书`, 'g'), title);
    }, value);
};

const parseWorldbookDedupeAiReviews = (
    rawText: string,
    contextById: Map<string, WorldbookDedupeAiReviewContext>,
): WorldbookDuplicateAiReview[] => {
    const parsed = extractJson(rawText);
    const rawReviews = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.reviews)
            ? parsed.reviews
            : Array.isArray(parsed?.results)
                ? parsed.results
                : [];
    const reviews = rawReviews.flatMap((item: any): WorldbookDuplicateAiReview[] => {
        const findingId = String(item?.findingId || item?.groupId || item?.id || item?.pairId || '').trim();
        const context = contextById.get(findingId);
        if (!context) return [];
        const cleanText = (value: string): string => replaceAiBookAliasesWithTitles(value, context);
        const verdict = cleanText(makeTextExcerpt(String(item?.verdict || item?.summary || item?.reason || '').trim(), 240));
        const reason = cleanText(makeTextExcerpt(String(item?.reason || item?.why || '').trim(), 180));
        const benefit = cleanText(makeTextExcerpt(String(item?.benefit || item?.value || item?.outcome || '').trim(), 180));
        return [{
            findingId,
            bookIds: context.bookRefs.map(book => book.id),
            bookTitles: context.bookRefs.map(book => book.title),
            relation: normalizedAiRelation(item?.relation || item?.type),
            functionalOverlap: Math.round(clamp(item?.functionalOverlap ?? item?.overlap ?? item?.score, 0, 100, 0)),
            verdict: verdict || 'AI 认为这组候选需要人工复核。',
            functionCategory: cleanText(String(item?.functionCategory || item?.category || '').trim()) || undefined,
            reason: reason || undefined,
            benefit: benefit || undefined,
            mergeAdvice: asReviewTextArray(item?.mergeAdvice || item?.suggestions || item?.advice).map(cleanText),
            keepAdvice: cleanText(String(item?.keepAdvice || item?.keep || '').trim()) || undefined,
            needsHumanReview: asReviewTextArray(item?.needsHumanReview || item?.questions || item?.risks).map(cleanText),
        }];
    });

    if (reviews.length === 0) {
        throw new Error('AI 深检没有返回可用的候选结论');
    }
    return reviews;
};

const parseDirectWorldbookDedupeAiReviews = (
    rawText: string,
    books: WorldbookLike[],
): WorldbookDuplicateAiReview[] => {
    const parsed = extractJson(rawText);
    const rawReviews = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.reviews)
            ? parsed.reviews
            : Array.isArray(parsed?.results)
                ? parsed.results
                : [];
    const order = bookOrderIndex(books);
    const bookById = new Map(books.map(book => [book.id, book]));
    const idsByTitle = new Map<string, string[]>();
    books.forEach(book => {
        const titleKey = normalizeComparableText(book.title || '');
        if (!titleKey) return;
        idsByTitle.set(titleKey, [...(idsByTitle.get(titleKey) || []), book.id]);
    });

    const resolveIds = (item: any): string[] => {
        const rawIds = [
            ...asStringArray(item?.bookIds),
            ...asStringArray(item?.ids),
            ...asStringArray(item?.worldbookIds),
        ];
        const fromTitles = [
            ...asStringArray(item?.bookTitles),
            ...asStringArray(item?.titles),
        ].flatMap(title => idsByTitle.get(normalizeComparableText(title)) || []);
        const ids = [...rawIds, ...fromTitles].filter(id => bookById.has(id));
        return sortBookIdsByInputOrder(Array.from(new Set(ids)), order);
    };

    return rawReviews.flatMap((item: any): WorldbookDuplicateAiReview[] => {
        const ids = resolveIds(item);
        if (ids.length < 2) return [];
        const bookRefs = ids.map(id => {
            const found = bookById.get(id);
            return { id, title: found?.title || id, category: found?.category };
        });
        const context: WorldbookDedupeAiReviewContext = {
            findingId: `direct:${ids.join('__')}`,
            bookRefs,
            findings: [],
            candidate: {},
        };
        const cleanText = (value: string): string => replaceAiBookAliasesWithTitles(value, context);
        const verdict = cleanText(makeTextExcerpt(String(item?.verdict || item?.summary || item?.reason || '').trim(), 240));
        return [{
            findingId: context.findingId,
            bookIds: ids,
            bookTitles: bookRefs.map(book => book.title),
            relation: normalizedAiRelation(item?.relation || item?.type),
            functionalOverlap: Math.round(clamp(item?.functionalOverlap ?? item?.overlap ?? item?.score, 0, 100, 0)),
            verdict: verdict || 'AI 认为这组候选需要人工复核。',
            mergeAdvice: asReviewTextArray(item?.mergeAdvice || item?.suggestions || item?.advice).map(cleanText),
            keepAdvice: cleanText(String(item?.keepAdvice || item?.keep || '').trim()) || undefined,
            needsHumanReview: asReviewTextArray(item?.needsHumanReview || item?.questions || item?.risks).map(cleanText),
        }];
    });
};

export const reviewWorldbookDuplicatesWithAI = async ({
    api,
    books,
    analysis,
    maxPairs = 10,
    fetchImpl = fetch,
}: ReviewWorldbookDuplicatesWithAIInput): Promise<WorldbookDuplicateAiResult> => {
    const baseUrl = String(api?.baseUrl || '').trim().replace(/\/+$/, '');
    const apiKey = String(api?.apiKey || '').trim();
    const model = String(api?.model || '').trim();
    if (!baseUrl || !apiKey || !model) {
        throw new Error('请先配置世界书去重 AI 的 URL、Key 和模型');
    }

    const findings = (analysis.findings || []).slice(0, Math.max(1, Math.floor(maxPairs)));
    if (findings.length === 0) {
        throw new Error('请先运行本地检测并获得候选重复项');
    }

    const contexts = buildWorldbookDedupeAiReviewContexts(books, findings);
    const contextById = new Map<string, WorldbookDedupeAiReviewContext>(
        contexts.map(context => [context.findingId, context]),
    );
    const temperature = clamp(api.temperature, 0, 2, 0.1);
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: WORLDBOOK_DEDUPE_AI_SYSTEM_PROMPT },
                { role: 'user', content: buildWorldbookDedupeAiPrompt(contexts) },
            ],
            temperature,
            stream: false,
            max_tokens: 1800,
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`世界书去重 AI 请求失败 (HTTP ${response.status})${detail ? `：${detail.slice(0, 160)}` : ''}`);
    }

    const data = await safeResponseJson(response);
    const rawText = extractContent(data);
    if (!rawText) throw new Error('世界书去重 AI 没有返回内容');
    return {
        model,
        reviewedAt: Date.now(),
        rawText,
        reviews: parseWorldbookDedupeAiReviews(rawText, contextById),
    };
};

export const reviewSelectedWorldbooksWithAI = async ({
    api,
    books,
    maxBooks = 24,
    fetchImpl = fetch,
}: ReviewSelectedWorldbooksWithAIInput): Promise<WorldbookDuplicateAiResult> => {
    const baseUrl = String(api?.baseUrl || '').trim().replace(/\/+$/, '');
    const apiKey = String(api?.apiKey || '').trim();
    const model = String(api?.model || '').trim();
    if (!baseUrl || !apiKey || !model) {
        throw new Error('请先配置世界书去重 AI 的 URL、Key 和模型');
    }

    const selectedBooks = books
        .filter(book => book && book.id && (book.title || book.content))
        .slice(0, Math.max(2, Math.floor(maxBooks)));
    if (selectedBooks.length < 2) {
        throw new Error('至少选择 2 本世界书才能 AI 深度检查');
    }

    const temperature = clamp(api.temperature, 0, 2, 0.1);
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: WORLDBOOK_DEDUPE_AI_SYSTEM_PROMPT },
                { role: 'user', content: buildDirectWorldbookDedupeAiPrompt(selectedBooks) },
            ],
            temperature,
            stream: false,
            max_tokens: 2400,
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`世界书 AI 深度检查请求失败 (HTTP ${response.status})${detail ? `：${detail.slice(0, 160)}` : ''}`);
    }

    const data = await safeResponseJson(response);
    const rawText = extractContent(data);
    if (!rawText) throw new Error('世界书 AI 深度检查没有返回内容');
    return {
        model,
        reviewedAt: Date.now(),
        rawText,
        reviews: parseDirectWorldbookDedupeAiReviews(rawText, selectedBooks),
    };
};

export const serializeStandardWorldbook = (books: WorldbookLike[]): string => {
    const usedUids = new Set<number>();
    const entries: Record<string, Record<string, unknown>> = {};

    books.forEach((book, index) => {
        let uid = Number.isFinite(book.sourceUid) ? Number(book.sourceUid) : index;
        while (usedUids.has(uid)) uid += 1;
        usedUids.add(uid);

        const primary = book.key || [];
        const secondary = book.keysecondary || [];
        const position = book.position ?? 1;
        entries[String(index)] = {
            uid,
            key: [...primary],
            keysecondary: [...secondary],
            comment: book.title,
            content: book.content,
            constant: book.constant ?? primary.length === 0,
            selective: book.selective ?? secondary.length > 0,
            selectiveLogic: book.selectiveLogic ?? 0,
            order: book.order ?? 100,
            position,
            disable: book.disable === true,
            probability: book.probability ?? 100,
            useProbability: book.useProbability === true,
            depth: book.depth ?? 4,
            role: position === 4 ? (book.role ?? 0) : null,
            scanDepth: book.scanDepth ?? null,
            caseSensitive: book.caseSensitive ?? null,
            matchWholeWords: book.matchWholeWords ?? null,
            displayIndex: index,
        };
    });

    return JSON.stringify({ entries }, null, 2);
};

export const parseStandardWorldbook = (
    rawText: string,
    category: string,
    now = Date.now(),
): Worldbook[] => {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
        throw new Error('不是受支持的标准世界书文件：缺少 entries');
    }
    const rawEntries = Array.isArray(parsed.entries)
        ? parsed.entries
        : Object.values(parsed.entries);

    const books = rawEntries.flatMap((value: any, index: number): Worldbook[] => {
        if (!value || typeof value !== 'object' || typeof value.content !== 'string') return [];
        const uid = Number.isFinite(Number(value.uid)) ? Number(value.uid) : index;
        const position = clamp(value.position, 0, 6, 1) as WorldbookPosition;
        const rawRole = value.role == null ? null : clamp(value.role, 0, 2, 0) as WorldbookDepthRole;
        return [{
            id: `wb-${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            title: String(value.comment || value.name || `条目 ${uid + 1}`),
            content: value.content,
            category,
            createdAt: now,
            updatedAt: now,
            key: asStringArray(value.key),
            keysecondary: asStringArray(value.keysecondary),
            constant: value.constant === true,
            selective: value.selective === true,
            selectiveLogic: clamp(value.selectiveLogic, 0, 3, 0) as WorldbookSelectiveLogic,
            order: Number.isFinite(Number(value.order)) ? Number(value.order) : 100,
            position,
            disable: value.disable === true,
            probability: clamp(value.probability, 0, 100, 100),
            useProbability: value.useProbability === true,
            depth: Math.max(0, Math.floor(clamp(value.depth, 0, 999, 4))),
            role: rawRole,
            scanDepth: value.scanDepth == null ? null : Math.max(0, Math.floor(clamp(value.scanDepth, 0, 999, 4))),
            caseSensitive: value.caseSensitive == null ? null : value.caseSensitive === true,
            matchWholeWords: value.matchWholeWords == null ? null : value.matchWholeWords === true,
            sourceUid: uid,
        }];
    });

    if (books.length === 0) throw new Error('世界书里没有可导入的有效条目');
    return books;
};
