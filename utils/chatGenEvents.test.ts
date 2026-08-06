import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    announceChatGen,
    CHAT_GEN_EVENTS,
    EMOTION_GEN_TTL_MS,
    getActiveEmotionCharIds,
    getActiveReplyCharIds,
    isChatEmotionActive,
    isChatReplyActive,
    REPLY_GEN_TTL_MS,
    setChatViewSnapshot,
    getChatViewSnapshot,
} from './chatGenEvents';

// node 环境无 window —— 派发函数必须静默降级（生成闭包/评估函数在测试与
// SSR 环境也会被调用，不能因为广播而抛错拖垮主流程）。

describe('chatGenEvents', () => {
    beforeEach(() => {
        // 清掉上一个用例可能残留的注册表状态
        for (const charId of getActiveReplyCharIds()) {
            announceChatGen(CHAT_GEN_EVENTS.replyEnd, { charId, charName: '' });
        }
        for (const charId of getActiveEmotionCharIds()) {
            announceChatGen(CHAT_GEN_EVENTS.emotionEnd, { charId, charName: '' });
        }
    });

    it('无 window 时 announceChatGen 不抛错', () => {
        expect(() => announceChatGen(CHAT_GEN_EVENTS.replyStart, { charId: 'c1', charName: '小角色' })).not.toThrow();
    });

    it('视图快照 set/get 往返一致，无 window 也不抛错', () => {
        expect(() => setChatViewSnapshot(true, 'c1')).not.toThrow();
        expect(getChatViewSnapshot()).toEqual({ chatOpen: true, charId: 'c1' });
        setChatViewSnapshot(false, null);
        expect(getChatViewSnapshot()).toEqual({ chatOpen: false, charId: null });
    });

    it('事件名稳定（ChatBroadcast / OSContext / useChatAI 三方约定）', () => {
        expect(CHAT_GEN_EVENTS.replyStart).toBe('chat-gen-reply-start');
        expect(CHAT_GEN_EVENTS.replyEnd).toBe('chat-gen-reply-end');
        expect(CHAT_GEN_EVENTS.replyArrived).toBe('chat-gen-reply-arrived');
        expect(CHAT_GEN_EVENTS.emotionStart).toBe('chat-gen-emotion-start');
        expect(CHAT_GEN_EVENTS.emotionEnd).toBe('chat-gen-emotion-end');
    });

    it('replyStart 标记、replyEnd 清除，无 window 也照常维护注册表', () => {
        expect(isChatReplyActive('c1')).toBe(false);

        announceChatGen(CHAT_GEN_EVENTS.replyStart, { charId: 'c1', charName: '小角色' });
        expect(isChatReplyActive('c1')).toBe(true);
        expect(getActiveReplyCharIds()).toEqual(['c1']);

        announceChatGen(CHAT_GEN_EVENTS.replyStart, { charId: 'c2', charName: '另一个' });
        expect(isChatReplyActive('c2')).toBe(true);
        expect(isChatReplyActive('c1')).toBe(true);

        announceChatGen(CHAT_GEN_EVENTS.replyEnd, { charId: 'c1', charName: '小角色' });
        expect(isChatReplyActive('c1')).toBe(false);
        expect(isChatReplyActive('c2')).toBe(true);

        announceChatGen(CHAT_GEN_EVENTS.replyEnd, { charId: 'c2', charName: '另一个' });
        expect(getActiveReplyCharIds()).toEqual([]);
    });

    it('reply 超过 TTL 后视为不再活跃（与 ChatBroadcast 兜底同源）', () => {
        vi.useFakeTimers();
        try {
            announceChatGen(CHAT_GEN_EVENTS.replyStart, { charId: 'c1', charName: '小角色' });
            expect(isChatReplyActive('c1')).toBe(true);

            vi.advanceTimersByTime(REPLY_GEN_TTL_MS + 1_000);
            expect(isChatReplyActive('c1')).toBe(false);
            expect(getActiveReplyCharIds()).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('emotionStart 标记、emotionEnd/emotionFailed 清除', () => {
        expect(isChatEmotionActive('c1')).toBe(false);

        announceChatGen(CHAT_GEN_EVENTS.emotionStart, { charId: 'c1', charName: '小角色' });
        expect(isChatEmotionActive('c1')).toBe(true);
        expect(getActiveEmotionCharIds()).toEqual(['c1']);

        // emotionFailed 也是终态（instant 超时路径只发 failed 没有 end）
        announceChatGen(CHAT_GEN_EVENTS.emotionFailed, {
            charId: 'c1', charName: '小角色', reason: '超时',
        });
        expect(isChatEmotionActive('c1')).toBe(false);

        // failed 之后再补 end 幂等
        announceChatGen(CHAT_GEN_EVENTS.emotionEnd, { charId: 'c1', charName: '小角色' });
        expect(getActiveEmotionCharIds()).toEqual([]);
    });

    it('emotion 超过 TTL 后视为不再活跃（与 ChatBroadcast 兜底同源）', () => {
        vi.useFakeTimers();
        try {
            announceChatGen(CHAT_GEN_EVENTS.emotionStart, { charId: 'c1', charName: '小角色' });
            expect(isChatEmotionActive('c1')).toBe(true);

            vi.advanceTimersByTime(EMOTION_GEN_TTL_MS + 1_000);
            expect(isChatEmotionActive('c1')).toBe(false);
            expect(getActiveEmotionCharIds()).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });
});
