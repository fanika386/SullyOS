import { describe, expect, it } from 'vitest';
import {
    DEFAULT_BUILT_IN_PROMPT_SETTINGS,
    ROLEPLAY_BUILT_IN_PROMPT_PRESET,
    isBuiltInPromptEnabled,
} from './builtInPromptSettings';

describe('built-in prompt settings', () => {
    it('defaults every built-in prompt group to enabled for existing characters', () => {
        for (const key of Object.keys(DEFAULT_BUILT_IN_PROMPT_SETTINGS) as Array<keyof typeof DEFAULT_BUILT_IN_PROMPT_SETTINGS>) {
            expect(isBuiltInPromptEnabled({} as any, key)).toBe(true);
        }
    });

    it('roleplay preset disables author behavior prompts while preserving character material', () => {
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.chatStyle).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.companionBehavior).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.emotionalResponse).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.antiFiller).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.scheduleAndEmotion).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.utilityPrompts).toBe(false);
        expect(ROLEPLAY_BUILT_IN_PROMPT_PRESET.recencyTail).toBe(false);
    });
});
