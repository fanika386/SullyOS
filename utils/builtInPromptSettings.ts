import type { BuiltInPromptSettings, CharacterProfile } from '../types';

export type BuiltInPromptSettingKey = keyof Required<BuiltInPromptSettings>;

export const BUILT_IN_PROMPT_SETTING_KEYS: BuiltInPromptSettingKey[] = [
    'chatStyle',
    'companionBehavior',
    'emotionalResponse',
    'antiFiller',
    'timeAwareness',
    'scheduleAndEmotion',
    'utilityPrompts',
    'recencyTail',
    'historyEventContext',
];

export const DEFAULT_BUILT_IN_PROMPT_SETTINGS: Required<BuiltInPromptSettings> = {
    chatStyle: true,
    companionBehavior: true,
    emotionalResponse: true,
    antiFiller: true,
    timeAwareness: true,
    scheduleAndEmotion: true,
    utilityPrompts: true,
    recencyTail: true,
    historyEventContext: true,
};

export const DAILY_CHAT_BUILT_IN_PROMPT_PRESET: Required<BuiltInPromptSettings> = {
    ...DEFAULT_BUILT_IN_PROMPT_SETTINGS,
};

export const ROLEPLAY_BUILT_IN_PROMPT_PRESET: Required<BuiltInPromptSettings> = {
    ...DEFAULT_BUILT_IN_PROMPT_SETTINGS,
    chatStyle: false,
    companionBehavior: false,
    emotionalResponse: false,
    antiFiller: false,
    timeAwareness: false,
    scheduleAndEmotion: false,
    utilityPrompts: false,
    recencyTail: false,
    historyEventContext: false,
};

export const BUILT_IN_PROMPT_SETTING_DEFINITIONS: Array<{
    key: BuiltInPromptSettingKey;
    label: string;
    description: string;
}> = [
    {
        key: 'chatStyle',
        label: '即时通讯风格',
        description: '口语短句、多气泡、不要名字和时间戳前缀。',
    },
    {
        key: 'companionBehavior',
        label: '真实陪伴感',
        description: '让角色像有自己生活和视角的人，不只围着用户转。',
    },
    {
        key: 'emotionalResponse',
        label: '情绪回应增强',
        description: '共情、察觉情绪变化、健康安全场景先稳再问。',
    },
    {
        key: 'antiFiller',
        label: '反空话增强',
        description: '拒绝万能安慰和套话，优先抓具体细节回应。',
    },
    {
        key: 'timeAwareness',
        label: '时间 / 现实状态',
        description: '当前时间、距离上次聊天、天气新闻等实时状态。',
    },
    {
        key: 'scheduleAndEmotion',
        label: '日程 / 情绪 Buff',
        description: '日程状态、情绪底色、后台情绪评估和下一轮 innerState。',
    },
    {
        key: 'utilityPrompts',
        label: '额外功能提示词',
        description: 'HTML、心象、语音、XHS、Notion/飞书、搜索、点单、MCP。',
    },
    {
        key: 'recencyTail',
        label: '末尾钢印',
        description: '最后强调听懂用户表达，并回到角色自己的说话方式。',
    },
    {
        key: 'historyEventContext',
        label: '历史事件转译',
        description: '把卡片、转账、戳一戳、小游戏等系统事件写进历史上下文。',
    },
];

export function normalizeBuiltInPromptSettings(
    settings?: BuiltInPromptSettings | null,
): Required<BuiltInPromptSettings> {
    return {
        ...DEFAULT_BUILT_IN_PROMPT_SETTINGS,
        ...(settings || {}),
    };
}

export function isBuiltInPromptEnabled(
    char: Pick<CharacterProfile, 'builtInPromptSettings'> | null | undefined,
    key: BuiltInPromptSettingKey,
): boolean {
    return normalizeBuiltInPromptSettings(char?.builtInPromptSettings)[key] !== false;
}

export function shouldInjectTimeAwareness(
    char: Pick<CharacterProfile, 'builtInPromptSettings' | 'timeAwarenessEnabled'> | null | undefined,
): boolean {
    return !!char && char.timeAwarenessEnabled !== false && isBuiltInPromptEnabled(char as any, 'timeAwareness');
}

export function shouldInjectScheduleAndEmotion(
    char: Pick<CharacterProfile, 'builtInPromptSettings'> | null | undefined,
): boolean {
    return isBuiltInPromptEnabled(char as any, 'scheduleAndEmotion');
}

export function shouldInjectUtilityPrompts(
    char: Pick<CharacterProfile, 'builtInPromptSettings'> | null | undefined,
): boolean {
    return isBuiltInPromptEnabled(char as any, 'utilityPrompts');
}
