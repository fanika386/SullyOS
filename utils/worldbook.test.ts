import { describe, expect, it } from 'vitest';
import type { MountedWorldbook } from '../types';
import {
    analyzeWorldbookDuplicates,
    buildWorldbookDedupeAiApiChoices,
    injectWorldbookDepthEntries,
    isWorldbookEntryActive,
    parseStandardWorldbook,
    reviewWorldbookDuplicatesWithAI,
    reviewSelectedWorldbooksWithAI,
    resolveWorldbookEntries,
    serializeStandardWorldbook,
    splitWorldbookSections,
    toMountedWorldbook,
} from './worldbook';

const book = (overrides: Partial<MountedWorldbook> = {}): MountedWorldbook => ({
    id: 'book-1',
    title: '测试条目',
    content: '{{char}} 在 {{user}} 提到月亮时会想起故乡。',
    category: '测试',
    ...overrides,
});

describe('worldbook activation', () => {
    it('keeps legacy entries constantly active after character definitions', () => {
        const resolved = resolveWorldbookEntries([book()], [], '阿澈', '小雨');
        expect(resolved).toHaveLength(1);
        expect(resolved[0].position).toBe(1);
        expect(resolved[0].content).toContain('阿澈 在 小雨');
    });

    it('activates keyword entries only when the recent scan buffer matches', () => {
        const keywordBook = book({ constant: false, key: ['月亮'], scanDepth: 2 });
        expect(isWorldbookEntryActive(keywordBook, [{ content: '今晚有月亮' }])).toBe(true);
        expect(isWorldbookEntryActive(keywordBook, [{ content: '今晚下雨' }])).toBe(false);
    });

    it('respects secondary keyword logic and disabled state', () => {
        const selectiveBook = book({
            constant: false,
            key: ['学校'],
            keysecondary: ['老师', '同学'],
            selective: true,
            selectiveLogic: 3,
        });
        expect(isWorldbookEntryActive(selectiveBook, [{ content: '学校里的老师和同学' }])).toBe(true);
        expect(isWorldbookEntryActive(selectiveBook, [{ content: '学校里的老师' }])).toBe(false);
        expect(isWorldbookEntryActive({ ...selectiveBook, disable: true }, [{ content: '学校里的老师和同学' }])).toBe(false);
    });
});

describe('worldbook positions', () => {
    it('splits standard positions and injects at-depth entries using their role', () => {
        const resolved = resolveWorldbookEntries([
            book({ id: 'before', position: 0 }),
            book({ id: 'depth', position: 4, depth: 1, role: 1 }),
        ]);
        const sections = splitWorldbookSections(resolved);
        expect(sections.beforeCharacter.map(entry => entry.book.id)).toEqual(['before']);

        const messages = injectWorldbookDepthEntries(
            [{ role: 'user', content: '一' }, { role: 'assistant', content: '二' }],
            sections.atDepth,
        );
        expect(messages.map(message => message.role)).toEqual(['user', 'user', 'assistant']);
        expect(messages[1].content).toContain('{{char}}');
    });
});

describe('standard worldbook import', () => {
    it('converts entries into a SullyOS category without losing activation metadata', () => {
        const imported = parseStandardWorldbook(JSON.stringify({
            entries: {
                0: {
                    uid: 7,
                    comment: '月亮设定',
                    content: '月亮是蓝色的。',
                    key: ['月亮'],
                    keysecondary: [],
                    constant: false,
                    selective: false,
                    order: 120,
                    position: 4,
                    depth: 2,
                    role: 0,
                    disable: false,
                    probability: 80,
                    useProbability: true,
                },
            },
        }), '导入测试', 1234);

        expect(imported).toHaveLength(1);
        expect(imported[0]).toMatchObject({
            title: '月亮设定',
            category: '导入测试',
            key: ['月亮'],
            constant: false,
            position: 4,
            depth: 2,
            role: 0,
            order: 120,
            probability: 80,
            useProbability: true,
            sourceUid: 7,
        });
    });

    it('exports a whole group as a standard worldbook that can be imported again', () => {
        const source = [{
            ...book({
                id: 'export-1',
                title: '导出条目',
                content: '导出内容',
                constant: false,
                key: ['导出'],
                position: 4,
                depth: 3,
                role: 2,
            }),
            category: '导出组',
            createdAt: 1,
            updatedAt: 1,
        }];

        const json = serializeStandardWorldbook(source);
        const raw = JSON.parse(json);
        expect(raw.entries['0']).toMatchObject({
            comment: '导出条目',
            key: ['导出'],
            position: 4,
            depth: 3,
            role: 2,
        });

        const imported = parseStandardWorldbook(json, '重新导入', 2);
        expect(imported[0]).toMatchObject({
            title: '导出条目',
            content: '导出内容',
            key: ['导出'],
            position: 4,
            depth: 3,
            role: 2,
        });
    });
});

describe('mounted worldbook synchronization', () => {
    it('copies edited activation and injection settings into the character mount cache', () => {
        const mounted = toMountedWorldbook({
            ...book({
                constant: false,
                key: ['月亮'],
                keysecondary: ['夜晚'],
                selective: true,
                selectiveLogic: 0,
                position: 4,
                depth: 2,
                role: 1,
                disable: true,
                order: 180,
                scanDepth: 6,
                useProbability: true,
                probability: 75,
            }),
            category: '同步测试',
            createdAt: 1,
            updatedAt: 2,
        });

        expect(mounted).toMatchObject({
            constant: false,
            key: ['月亮'],
            keysecondary: ['夜晚'],
            selective: true,
            position: 4,
            depth: 2,
            role: 1,
            disable: true,
            order: 180,
            scanDepth: 6,
            useProbability: true,
            probability: 75,
        });
        expect(mounted).not.toHaveProperty('createdAt');
        expect(mounted).not.toHaveProperty('updatedAt');
    });
});

describe('worldbook duplicate analysis', () => {
    it('flags exact content duplicates with merge advice', () => {
        const analysis = analyzeWorldbookDuplicates([
            book({ id: 'moon-a', title: '月城设定 A', content: '月城是一座悬浮在海上的城市。\n居民以潮汐钟计时。' }),
            book({ id: 'moon-b', title: '月城设定 B', content: '月城是一座悬浮在海上的城市。\n居民以潮汐钟计时。' }),
        ]);

        expect(analysis.comparedPairs).toBe(1);
        expect(analysis.duplicatePairs).toBe(1);
        expect(analysis.highestDuplicateRate).toBe(100);
        expect(analysis.findings[0]).toMatchObject({
            bookA: { id: 'moon-a', title: '月城设定 A' },
            bookB: { id: 'moon-b', title: '月城设定 B' },
            severity: 'exact',
        });
        expect(analysis.findings[0].suggestions.join('\n')).toContain('合并');
    });

    it('detects partial semantic overlap while ignoring unrelated books', () => {
        const analysis = analyzeWorldbookDuplicates([
            book({
                id: 'guild-a',
                title: '观星公会',
                key: ['观星公会', '星图'],
                content: '观星公会负责维护星图。成员会记录流星雨、潮汐异常和月城航线。',
            }),
            book({
                id: 'guild-b',
                title: '星图管理员',
                key: ['星图', '管理员'],
                content: '星图管理员隶属于观星公会，主要工作是校准月城航线，并把潮汐异常写入档案。',
            }),
            book({
                id: 'bakery',
                title: '面包店',
                key: ['面包'],
                content: '港口面包店每天清晨开门，招牌是蜂蜜牛角包。',
            }),
        ]);

        expect(analysis.comparedPairs).toBe(3);
        expect(analysis.findings).toHaveLength(1);
        expect(analysis.findings[0].bookA.id).toBe('guild-a');
        expect(analysis.findings[0].bookB.id).toBe('guild-b');
        expect(analysis.findings[0].duplicateRate).toBeGreaterThanOrEqual(45);
        expect(analysis.cleanBookIds).toContain('bakery');
    });

    it('returns an empty finding list when selected books do not overlap', () => {
        const analysis = analyzeWorldbookDuplicates([
            book({ id: 'a', title: '森林', content: '森林里有古老神树和守林人。' }),
            book({ id: 'b', title: '港口', content: '港口停靠商船，夜里点亮蓝色灯塔。' }),
            book({ id: 'c', title: '学院', content: '学院教授炼金术、礼仪课和古代语言。' }),
        ]);

        expect(analysis.duplicatePairs).toBe(0);
        expect(analysis.highestDuplicateRate).toBeLessThan(35);
        expect(analysis.findings).toEqual([]);
        expect(analysis.cleanBookIds.sort()).toEqual(['a', 'b', 'c']);
    });
});

describe('worldbook duplicate AI review', () => {
    it('resolves the selected preset as the AI review API without changing chat settings', () => {
        const choices = buildWorldbookDedupeAiApiChoices({
            chatApi: { baseUrl: 'https://chat.example.test/v1', apiKey: 'sk-chat', model: 'expensive-chat' },
            dedicatedApi: { enabled: true, baseUrl: 'https://dedupe.example.test/v1', apiKey: 'sk-dedupe', model: 'cheap-dedupe' },
            presets: [{
                id: 'preset-mini',
                name: '便宜小模型',
                config: { baseUrl: 'https://mini.example.test/v1', apiKey: 'sk-mini', model: 'mini-reviewer' },
            }],
            selectedChoiceId: 'preset:preset-mini',
        });

        expect(choices.selected.id).toBe('preset:preset-mini');
        expect(choices.options[0].helperText).toContain('默认跟随平时聊天用的模型');
        expect(choices.options[0].helperText).toContain('比较贵');
        expect(choices.options[0].helperText).toContain('大材小用');
        expect(choices.selected.label).toContain('便宜小模型');
        expect(choices.selected.api).toMatchObject({
            baseUrl: 'https://mini.example.test/v1',
            apiKey: 'sk-mini',
            model: 'mini-reviewer',
        });
        expect(choices.options.map(option => option.id)).toEqual(['chat', 'dedupe', 'preset:preset-mini']);
    });

    it('sends only locally flagged duplicate candidates to a cheap review model', async () => {
        const books = [
            book({
                id: 'guild-a',
                title: '观星公会',
                key: ['观星公会', '星图'],
                content: '观星公会负责维护星图。成员会记录流星雨、潮汐异常和月城航线。',
            }),
            book({
                id: 'guild-b',
                title: '星图管理员',
                key: ['星图', '管理员'],
                content: '星图管理员隶属于观星公会，主要工作是校准月城航线，并把潮汐异常写入档案。',
            }),
            book({
                id: 'bakery',
                title: '面包店',
                key: ['面包'],
                content: '港口面包店每天清晨开门，招牌是蜂蜜牛角包。',
            }),
        ];
        const analysis = analyzeWorldbookDuplicates(books);
        let requestedUrl = '';
        let requestedBody: any = null;

        const result = await reviewWorldbookDuplicatesWithAI({
            api: { baseUrl: 'https://api.example.test/v1', apiKey: 'sk-test', model: 'cheap-reviewer' },
            books,
            analysis,
            fetchImpl: async (url, init) => {
                requestedUrl = String(url);
                requestedBody = JSON.parse(String(init?.body));
                return new Response(JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                reviews: [{
                                    findingId: 'guild-a__guild-b',
                                    relation: 'duplicate',
                                    functionalOverlap: 88,
                                    verdict: '两条都在解释观星公会如何维护星图和月城航线。',
                                    mergeAdvice: ['合并共同职责，把独有称谓作为小节保留。'],
                                    keepAdvice: '保留信息更完整的一条作为主条目。',
                                    needsHumanReview: ['确认星图管理员是否是职位还是组织。'],
                                }],
                            }),
                        },
                    }],
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });

        expect(requestedUrl).toBe('https://api.example.test/v1/chat/completions');
        expect(requestedBody.model).toBe('cheap-reviewer');
        expect(requestedBody.temperature).toBe(0.1);
        expect(requestedBody.stream).toBe(false);
        expect(requestedBody.messages[1].content).toContain('guild-a__guild-b');
        expect(requestedBody.messages[1].content).toContain('观星公会');
        expect(requestedBody.messages[1].content).not.toContain('蜂蜜牛角包');
        expect(requestedBody.messages[0].content).toContain('通俗');
        expect(requestedBody.messages[0].content).toContain('像给普通用户写提示');
        expect(requestedBody.messages[1].content).toContain('粗略扫重');
        expect(requestedBody.messages[1].content).toContain('不用写学术分析');

        expect(result.model).toBe('cheap-reviewer');
        expect(result.reviews).toHaveLength(1);
        expect(result.reviews[0]).toMatchObject({
            findingId: 'guild-a__guild-b',
            relation: 'duplicate',
            functionalOverlap: 88,
            verdict: '两条都在解释观星公会如何维护星图和月城航线。',
        });
    });

    it('replaces AI Book A and Book B wording with real worldbook titles', async () => {
        const books = [
            book({
                id: 'guild-a',
                title: '观星公会',
                key: ['观星公会', '星图'],
                content: '观星公会负责维护星图。成员会记录流星雨、潮汐异常和月城航线。',
            }),
            book({
                id: 'guild-b',
                title: '星图管理员',
                key: ['星图', '管理员'],
                content: '星图管理员隶属于观星公会，主要工作是校准月城航线，并把潮汐异常写入档案。',
            }),
        ];
        const analysis = analyzeWorldbookDuplicates(books);
        let requestedBody: any = null;

        const result = await reviewWorldbookDuplicatesWithAI({
            api: { baseUrl: 'https://api.example.test/v1', apiKey: 'sk-test', model: 'cheap-reviewer' },
            books,
            analysis,
            fetchImpl: async (_url, init) => {
                requestedBody = JSON.parse(String(init?.body));
                return new Response(JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                reviews: [{
                                    findingId: 'guild-a__guild-b',
                                    relation: 'overlap',
                                    functionalOverlap: 72,
                                    verdict: 'Book A 和 Book B 在讲同一套星图工作。',
                                    mergeAdvice: ['把 Book A 的组织说明和 Book B 的职位说明合在一起。'],
                                    keepAdvice: '保留 Book B 当主条目。',
                                    needsHumanReview: ['确认 Book A 是否还包含独立组织设定。'],
                                }],
                            }),
                        },
                    }],
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });

        expect(requestedBody.messages[0].content).toContain('不要用 Book A、Book B');
        expect(requestedBody.messages[1].content).toContain('观星公会');
        expect(requestedBody.messages[1].content).toContain('星图管理员');
        expect(JSON.stringify(result.reviews[0])).not.toContain('Book A');
        expect(JSON.stringify(result.reviews[0])).not.toContain('Book B');
        expect(result.reviews[0].verdict).toContain('「观星公会」');
        expect(result.reviews[0].verdict).toContain('「星图管理员」');
        expect(result.reviews[0].mergeAdvice[0]).toContain('「观星公会」');
        expect(result.reviews[0].keepAdvice).toContain('「星图管理员」');
        expect(result.reviews[0].needsHumanReview[0]).toContain('「观星公会」');
    });

    it('reviews connected duplicate findings as one multi-book group', async () => {
        const books = [
            book({
                id: 'guild-a',
                title: '观星公会',
                key: ['观星公会', '星图'],
                content: '观星公会负责维护星图。成员会记录流星雨、潮汐异常和月城航线。',
            }),
            book({
                id: 'guild-b',
                title: '星图管理员',
                key: ['星图', '管理员'],
                content: '星图管理员隶属于观星公会，主要工作是校准月城航线，并把潮汐异常写入档案。',
            }),
            book({
                id: 'guild-c',
                title: '星图档案',
                key: ['星图档案', '潮汐异常'],
                content: '星图档案收录观星公会记录的流星雨、潮汐异常和月城航线校准结果。',
            }),
        ];
        const analysis = analyzeWorldbookDuplicates(books);
        let requestedBody: any = null;

        const result = await reviewWorldbookDuplicatesWithAI({
            api: { baseUrl: 'https://api.example.test/v1', apiKey: 'sk-test', model: 'cheap-reviewer' },
            books,
            analysis,
            fetchImpl: async (_url, init) => {
                requestedBody = JSON.parse(String(init?.body));
                return new Response(JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                reviews: [{
                                    findingId: 'group:guild-a__guild-b__guild-c',
                                    relation: 'duplicate',
                                    functionalOverlap: 84,
                                    verdict: 'Book A、Book B 和 Book C 都在讲星图维护。',
                                    functionCategory: '组织与职责',
                                    reason: '现在三条都在讲同一件事，挂给角色时容易重复塞设定。',
                                    benefit: '合成后 Book C 可以当补充小节，以后挂给不同角色更清楚，也更省提示词。',
                                    mergeAdvice: ['把 Book A 的组织、Book B 的职位、Book C 的档案内容合成一条。'],
                                    keepAdvice: '用 Book C 当补充小节。',
                                    needsHumanReview: ['确认 Book B 是否需要单独保留职位设定。'],
                                }],
                            }),
                        },
                    }],
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });

        const prompt = JSON.parse(requestedBody.messages[1].content);
        expect(prompt.duplicateGroups).toHaveLength(1);
        expect(prompt.duplicateGroups[0].findingId).toBe('group:guild-a__guild-b__guild-c');
        expect(prompt.duplicateGroups[0].books.map((item: any) => item.title)).toEqual(['观星公会', '星图管理员', '星图档案']);
        expect(prompt.candidates).toBeUndefined();
        expect(requestedBody.messages[0].content).toContain('方便挂给不同角色');
        expect(requestedBody.messages[1].content).toContain('按功能分类');
        expect(requestedBody.messages[1].content).toContain('为什么建议这样改');
        expect(requestedBody.messages[1].content).toContain('这样改有什么好处');
        expect(result.reviews).toHaveLength(1);
        expect(result.reviews[0].bookTitles).toEqual(['观星公会', '星图管理员', '星图档案']);
        expect(result.reviews[0].functionCategory).toBe('组织与职责');
        expect(result.reviews[0].reason).toContain('挂给角色');
        expect(result.reviews[0].benefit).toContain('「星图档案」');
        expect(result.reviews[0].benefit).toContain('不同角色');
        expect(JSON.stringify(result.reviews[0])).not.toContain('Book C');
        expect(result.reviews[0].verdict).toContain('「星图档案」');
        expect(result.reviews[0].mergeAdvice[0]).toContain('「观星公会」');
        expect(result.reviews[0].mergeAdvice[0]).toContain('「星图管理员」');
        expect(result.reviews[0].keepAdvice).toContain('「星图档案」');
    });

    it('can ask AI to directly review selected books without local duplicate candidates', async () => {
        const books = [
            book({
                id: 'moon-city-a',
                title: '月城旧灾',
                key: ['月城'],
                content: '月城的人害怕外来者，因为十年前发生过灾难。',
            }),
            book({
                id: 'moon-city-b',
                title: '蓝都戒备',
                key: ['蓝都'],
                content: '这个城市对陌生人很警惕，背后和过去一次事故有关。',
            }),
            book({
                id: 'bakery',
                title: '港口面包店',
                key: ['面包'],
                content: '港口面包店每天清晨开门，招牌是蜂蜜牛角包。',
            }),
        ];
        const localAnalysis = analyzeWorldbookDuplicates(books);
        expect(localAnalysis.findings).toHaveLength(0);

        let requestedBody: any = null;
        const result = await reviewSelectedWorldbooksWithAI({
            api: { baseUrl: 'https://api.example.test/v1', apiKey: 'sk-test', model: 'cheap-reviewer' },
            books,
            fetchImpl: async (_url, init) => {
                requestedBody = JSON.parse(String(init?.body));
                return new Response(JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                reviews: [{
                                    bookIds: ['moon-city-a', 'moon-city-b'],
                                    relation: 'duplicate',
                                    functionalOverlap: 86,
                                    verdict: '「月城旧灾」和「蓝都戒备」都在说同一座城市因旧事故排斥外来者。',
                                    mergeAdvice: ['合并旧事故和排斥外来者这两点。'],
                                    keepAdvice: '保留信息更完整的一条。',
                                    needsHumanReview: ['确认月城和蓝都是否是同一座城市。'],
                                }],
                            }),
                        },
                    }],
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            },
        });

        expect(requestedBody.messages[1].content).toContain('direct_review_selected_worldbooks');
        expect(requestedBody.messages[1].content).toContain('月城的人害怕外来者');
        expect(requestedBody.messages[1].content).toContain('陌生人很警惕');
        expect(requestedBody.messages[1].content).toContain('蜂蜜牛角包');
        expect(result.reviews).toHaveLength(1);
        expect(result.reviews[0]).toMatchObject({
            findingId: 'direct:moon-city-a__moon-city-b',
            bookIds: ['moon-city-a', 'moon-city-b'],
            bookTitles: ['月城旧灾', '蓝都戒备'],
            relation: 'duplicate',
            functionalOverlap: 86,
        });
    });

    it('rejects incomplete AI review API configuration before making a request', async () => {
        await expect(reviewWorldbookDuplicatesWithAI({
            api: { baseUrl: '', apiKey: 'sk-test', model: 'cheap-reviewer' },
            books: [],
            analysis: analyzeWorldbookDuplicates([]),
            fetchImpl: async () => {
                throw new Error('fetch should not be called');
            },
        })).rejects.toThrow('请先配置世界书去重 AI');
    });
});
