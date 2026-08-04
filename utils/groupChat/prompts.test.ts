import { describe, it, expect } from 'vitest';
import { buildGroupHistoryBlock, buildMemberPrivateStateBlock, buildRoundRobinInstruction, GROUP_HISTORY_GAP_THRESHOLD_MS } from './prompts';
import type { Message, CharacterProfile } from '../../types';

const char = (id: string, name: string): CharacterProfile => ({ id, name } as CharacterProfile);

const msg = (id: number, role: Message['role'], content: string, timestamp: number, charId = ''): Message =>
    ({ id, role, type: 'text', content, timestamp, charId } as Message);

describe('buildGroupHistoryBlock 时间跳变分隔行', () => {
    const chars = [char('c1', '小夏')];
    const base = Date.UTC(2026, 6, 1, 12, 0, 0);

    it('相邻消息隔得久时插一条"隔了约 N 天"的分隔行', () => {
        const msgs: Message[] = [
            msg(1, 'assistant', '在吗', base, 'c1'),
            // 3 天后用户回来发一句
            msg(2, 'user', '我回来了', base + 3 * 24 * 60 * 60 * 1000),
        ];
        const { text } = buildGroupHistoryBlock(msgs, chars, [], '用户');
        expect(text).toContain('约 3 天');
        expect(text).toContain('中间群里没人说话');
        // 分隔行应夹在两条消息之间
        expect(text.indexOf('小夏: 在吗')).toBeLessThan(text.indexOf('约 3 天'));
        expect(text.indexOf('约 3 天')).toBeLessThan(text.indexOf('用户: 我回来了'));
    });

    it('间隔在阈值以内不插分隔行', () => {
        const msgs: Message[] = [
            msg(1, 'assistant', '早', base, 'c1'),
            msg(2, 'user', '早呀', base + 60 * 1000),
        ];
        const { text } = buildGroupHistoryBlock(msgs, chars, [], '用户');
        expect(text).not.toContain('中间群里没人说话');
        expect(text).toBe('小夏: 早\n用户: 早呀');
    });

    it('阈值常量为 3 小时', () => {
        expect(GROUP_HISTORY_GAP_THRESHOLD_MS).toBe(3 * 60 * 60 * 1000);
    });
});

describe('buildMemberPrivateStateBlock 跟随角色开关', () => {
    const timeline = '[私聊][07-10 22:14] 用户: 今天好累……';

    it('默认（线上聊天）角色保留私聊状态块', () => {
        const block = buildMemberPrivateStateBlock(char('c1', '小夏'), '刚刚', timeline);
        expect(block).toContain('重点：私聊状态');
        expect(block).toContain(timeline);
    });

    it('chatStyle 关闭（非线上聊天 / 角色扮演）时不注入私聊状态块', () => {
        const rpChar = char('c1', '小夏') as CharacterProfile & { builtInPromptSettings?: unknown };
        rpChar.builtInPromptSettings = { chatStyle: false };
        const block = buildMemberPrivateStateBlock(rpChar, '刚刚', timeline);
        expect(block).toBe('');
    });
});

describe('buildRoundRobinInstruction 跟随角色开关', () => {
    const history = { text: '小夏: 在吗', attachedImages: [], attachedImagesNote: '' };

    it('以角色本人为视角，默认保留对话质量与私聊感知规则', () => {
        const ins = buildRoundRobinInstruction(char('c1', '小夏'), history, '通用: [哈哈]');
        expect(ins).toContain('以「小夏」的身份在群里发言');
        expect(ins).toContain('对话质量沿用你的私聊标准');
        expect(ins).toContain('私聊空窗期');
    });

    it('antiFiller 关闭时不注入对话质量规则', () => {
        const rpChar = char('c1', '小夏') as CharacterProfile & { builtInPromptSettings?: unknown };
        rpChar.builtInPromptSettings = { antiFiller: false };
        const ins = buildRoundRobinInstruction(rpChar, history, '通用: [哈哈]');
        expect(ins).not.toContain('对话质量沿用你的私聊标准');
        expect(ins).toContain('私聊空窗期');
    });

    it('chatStyle 关闭时不注入私聊感知规则', () => {
        const rpChar = char('c1', '小夏') as CharacterProfile & { builtInPromptSettings?: unknown };
        rpChar.builtInPromptSettings = { chatStyle: false };
        const ins = buildRoundRobinInstruction(rpChar, history, '通用: [哈哈]');
        expect(ins).not.toContain('私聊空窗期');
        expect(ins).toContain('对话质量沿用你的私聊标准');
    });
});
