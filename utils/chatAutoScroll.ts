export const NEAR_BOTTOM_THRESHOLD_PX = 120;

export interface ScrollMetrics {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
}

export function isNearBottom(
    metrics: ScrollMetrics,
    thresholdPx: number = NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
    return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= thresholdPx;
}

export interface AutoScrollDecision {
    hasContainer: boolean;
    stickToBottom: boolean;
    /** 选中模式 / windowed 旧消息浏览模式等会挡住自动吸底的场景。 */
    blocked: boolean;
    /** 是否有值得跟随的新内容（新消息追加、AI 正在生成等）。 */
    shouldFollow: boolean;
}

export function shouldAutoScrollToBottom(decision: AutoScrollDecision): boolean {
    return (
        decision.hasContainer
        && decision.stickToBottom
        && !decision.blocked
        && decision.shouldFollow
    );
}

export interface JumpToLatestDecision {
    stickToBottom: boolean;
    blocked: boolean;
    generating: boolean;
}

export function shouldShowJumpToLatest(decision: JumpToLatestDecision): boolean {
    return !decision.stickToBottom && !decision.blocked && decision.generating;
}

export type AutoScrollAction = 'none' | 'snap' | 'smooth';

export interface AutoScrollActionInput {
    stickToBottom: boolean;
    blocked: boolean;
    generating: boolean;
}

/**
 * 吸底跟随的滚动策略：生成中逐条来内容时用瞬时贴底（snap），
 * 避免每来一段内容就重启一次 smooth 滚动动画造成视口弹跳。
 */
export function resolveAutoScrollAction(input: AutoScrollActionInput): AutoScrollAction {
    if (!input.stickToBottom || input.blocked || !input.generating) return 'none';
    return 'snap';
}
