import { describe, expect, it } from 'vitest';
import { buildChatRequestPayload } from './chatRequestPayload';

const userProfile = { id: 'u1', name: '我', avatar: '', bio: '' } as any;
const history = [
    { id: 1, charId: 'c1', role: 'user', type: 'text', content: '做一张邀请函', timestamp: Date.now() },
] as any[];

describe('buildChatRequestPayload built-in prompt switches', () => {
    it('keeps optional feature prompts enabled by default', async () => {
        const payload = await buildChatRequestPayload({
            char: {
                id: 'c1',
                name: '小角色',
                description: '',
                systemPrompt: '你是小角色。',
                memories: [],
                chatVoiceEnabled: true,
            } as any,
            userProfile,
            groups: [],
            emojis: [],
            categories: [],
            historyMsgs: history,
            contextLimit: 10,
            htmlMode: { enabled: true },
            thinkingChain: { enabled: true },
        });

        expect(payload.flags.htmlActive).toBe(true);
        expect(payload.flags.thinkingActive).toBe(true);
        expect(payload.systemPrompt).toContain('[html]');
        expect(payload.systemPrompt).toContain('语音消息功能');
        expect(payload.systemPrompt).toContain('Thinking 阶段');
    });

    it('can suppress optional feature prompts even when feature toggles are on', async () => {
        const payload = await buildChatRequestPayload({
            char: {
                id: 'c1',
                name: '小角色',
                description: '',
                systemPrompt: '你是小角色。',
                memories: [],
                chatVoiceEnabled: true,
                builtInPromptSettings: { utilityPrompts: false },
            } as any,
            userProfile,
            groups: [],
            emojis: [],
            categories: [],
            historyMsgs: history,
            contextLimit: 10,
            htmlMode: { enabled: true },
            thinkingChain: { enabled: true },
        });

        expect(payload.flags.htmlActive).toBe(false);
        expect(payload.flags.thinkingActive).toBe(false);
        expect(payload.systemPrompt).not.toContain('[html]');
        expect(payload.systemPrompt).not.toContain('语音消息功能');
        expect(payload.systemPrompt).not.toContain('Thinking 阶段');
    });
});
