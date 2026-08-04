import { describe, expect, it } from 'vitest';
import { ChatPrompts } from './chatPrompts';

const userProfile = { id: 'u1', name: '我', avatar: '', bio: '玩家设定' } as any;

const baseChar = {
    id: 'c1',
    name: '小角色',
    description: '测试角色',
    systemPrompt: '你是小角色。保留这段核心人设。',
    worldview: '这是一个必须保留的世界观。',
    memories: [{ date: '2026-08-01', mood: 'rec', summary: '必须保留的记忆。' }],
    activeMemoryMonths: ['2026-08'],
    mountedWorldbooks: [],
} as any;

const history = [
    { id: 1, charId: 'c1', role: 'user', type: 'text', content: '你好', timestamp: Date.now() - 1000 },
] as any[];

describe('ChatPrompts built-in prompt switches', () => {
    it('keeps existing SullyOS prompt behavior by default', async () => {
        const parts = await ChatPrompts.buildSystemPromptParts(baseChar, userProfile, [], [], [], history);
        const combined = parts.stable + parts.volatileState + parts.recencyTail;

        expect(combined).toContain('聊天 App 行为规范');
        expect(combined).toContain('表达底线');
        expect(combined).toContain('最后，回到你自己');
        expect(combined).toContain('你是小角色。保留这段核心人设。');
    });

    it('can remove author behavior prompts without removing character, world, user, or memory material', async () => {
        const parts = await ChatPrompts.buildSystemPromptParts({
            ...baseChar,
            builtInPromptSettings: {
                chatStyle: false,
                companionBehavior: false,
                emotionalResponse: false,
                antiFiller: false,
                recencyTail: false,
            },
        }, userProfile, [], [], [], history);
        const combined = parts.stable + parts.volatileState + parts.recencyTail;

        expect(combined).not.toContain('聊天 App 行为规范');
        expect(combined).not.toContain('表达底线');
        expect(combined).not.toContain('最后，回到你自己');
        expect(combined).toContain('你是小角色。保留这段核心人设。');
        expect(combined).toContain('这是一个必须保留的世界观。');
        expect(combined).toContain('玩家设定');
        expect(combined).toContain('必须保留的记忆。');
    });

    it('can omit translated historical event cards from prompt history', () => {
        const { apiMessages } = ChatPrompts.buildMessageHistory([
            { id: 1, charId: 'c1', role: 'user', type: 'text', content: '普通文本', timestamp: Date.now() - 3000 },
            { id: 2, charId: 'c1', role: 'user', type: 'transfer', content: '[转账]', metadata: { amount: 10 }, timestamp: Date.now() - 2000 },
            { id: 3, charId: 'c1', role: 'assistant', type: 'html_card', content: '[HTML卡片] 邀请函', metadata: { htmlTextPreview: '邀请函' }, timestamp: Date.now() - 1000 },
        ] as any[], 10, {
            ...baseChar,
            builtInPromptSettings: { historyEventContext: false },
        }, userProfile, []);

        const text = apiMessages.map((m: any) => String(m.content)).join('\n');
        expect(text).toContain('普通文本');
        expect(text).not.toContain('转账');
        expect(text).not.toContain('HTML 卡片');
        expect(text).not.toContain('邀请函');
    });

    it('injects music atmosphere by default when the user is listening to music', async () => {
        const parts = await ChatPrompts.buildSystemPromptParts(
            baseChar, userProfile, [], [], [], history,
            undefined, undefined,
            { songName: '夜曲', artists: '周杰伦', lyricWindow: [], activeIdx: -1 },
            false,
        );
        const combined = parts.stable + parts.volatileState + parts.recencyTail;

        expect(combined).toContain('此刻的对话氛围');
        expect(combined).toContain('夜曲');
    });

    it('omits music atmosphere when the music switch is off', async () => {
        const parts = await ChatPrompts.buildSystemPromptParts(
            {
                ...baseChar,
                builtInPromptSettings: { musicAtmosphere: false },
            },
            userProfile, [], [], [], history,
            undefined, undefined,
            { songName: '夜曲', artists: '周杰伦', lyricWindow: [], activeIdx: -1 },
            false,
        );
        const combined = parts.stable + parts.volatileState + parts.recencyTail;

        expect(combined).not.toContain('此刻的对话氛围');
        expect(combined).not.toContain('夜曲');
        expect(combined).toContain('你是小角色。保留这段核心人设。');
    });
});
