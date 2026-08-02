import type {
    MountedWorldbook,
    Worldbook,
    WorldbookDepthRole,
    WorldbookPosition,
    WorldbookSelectiveLogic,
} from '../types';

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
        .split(/[\n\r]+|(?<=[。！？!?；;])/u)
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
