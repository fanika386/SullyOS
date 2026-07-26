import { describe, expect, it } from 'vitest';
import { ChatPrompts } from './chatPrompts';
import type { Message } from '../types';

const char = { id: 'char-1', name: '嘉嘉' } as any;
const userProfile = { name: '我' } as any;

const xhsCard = (note: any): Message => ({
    id: 1,
    charId: 'char-1',
    role: 'user',
    type: 'xhs_card',
    content: note.title || '小红书笔记',
    timestamp: Date.now(),
    metadata: { xhsNote: note },
} as Message);

describe('ChatPrompts.buildMessageHistory · xhs_card', () => {
    it('marks an XHS card with no body as unreadable instead of inviting the model to improvise', () => {
        const { apiMessages } = ChatPrompts.buildMessageHistory(
            [xhsCard({ noteId: 'abc123', title: '露营好物', desc: '', author: '', likes: 0 })],
            10,
            char,
            userProfile,
            [],
        );

        const content = String(apiMessages[0].content);
        expect(content).toContain('露营好物');
        expect(content).toContain('noteId=abc123');
        expect(content).toContain('XHS_DETAIL: https://www.xiaohongshu.com/explore/abc123');
        expect(content).toContain('正文/评论没抓到');
        expect(content).toContain('别假装读过');
        expect(content).toContain('不要改用标题搜索来冒充这篇原帖');
        expect(content).not.toContain('请根据你的性格对这个帖子发表看法');
    });
});
