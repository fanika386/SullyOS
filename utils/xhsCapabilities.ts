import type { XhsCapabilities } from '../types';

/**
 * 小红书能力范围（全局配置，所有角色统一遵守）。
 * 默认：只读能力开（搜索/浏览/详情/主页/分享卡片），写操作全部关。
 * 用户可在「实时感知 → 小红书」里按需打开某个互动能力。
 */
export const DEFAULT_XHS_CAPABILITIES: XhsCapabilities = {
    search: true,
    browse: true,
    detail: true,
    myProfile: true,
    share: true,
    comment: false,
    reply: false,
    like: false,
    favorite: false,
    post: false,
};

/** 合并用户配置与默认值，缺省一律回落到默认 */
export const resolveXhsCapabilities = (c?: XhsCapabilities): XhsCapabilities => ({
    ...DEFAULT_XHS_CAPABILITIES,
    ...c,
});

/** 是否处于完全只读（没有任何写操作能力） */
export const isXhsFullyReadOnly = (c: XhsCapabilities): boolean =>
    !c.comment && !c.reply && !c.like && !c.favorite && !c.post;
