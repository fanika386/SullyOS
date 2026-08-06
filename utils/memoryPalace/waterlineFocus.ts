/**
 * 聊天设置「去记忆宫殿调整节奏」的跳转桥接。
 *
 * MemoryPalaceApp 挂载前还没有 React 监听器，所以用模块级待消费标记：
 * Chat 先写入目标角色 id，再 openApp；记忆宫殿组件挂载后一次性消费，
 * 自动选中该角色并展开「聊天记忆整理节奏」编辑器。
 */
let pendingFocusCharId: string | null = null;

export function requestMemoryPalaceWaterlineFocus(charId: string): void {
    pendingFocusCharId = charId;
}

export function consumeMemoryPalaceWaterlineFocus(): string | null {
    const charId = pendingFocusCharId;
    pendingFocusCharId = null;
    return charId;
}
