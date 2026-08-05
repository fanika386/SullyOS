import { describe, expect, it } from 'vitest';
import {
    isNearBottom,
    resolveAutoScrollAction,
    shouldAutoScrollToBottom,
    shouldShowJumpToLatest,
} from './chatAutoScroll';

describe('isNearBottom', () => {
    const metrics = { scrollTop: 0, clientHeight: 300, scrollHeight: 800 };

    it('returns true when the scroll container sits exactly at the bottom', () => {
        expect(isNearBottom({ ...metrics, scrollTop: 500 })).toBe(true);
    });

    it('returns true when the remaining distance is within the follow threshold', () => {
        expect(isNearBottom({ ...metrics, scrollTop: 400 })).toBe(true);
    });

    it('returns false when the user has scrolled well above the bottom', () => {
        expect(isNearBottom({ ...metrics, scrollTop: 100 })).toBe(false);
    });

    it('respects a custom threshold', () => {
        expect(isNearBottom({ ...metrics, scrollTop: 400 }, 60)).toBe(false);
    });
});

describe('shouldAutoScrollToBottom', () => {
    const base = {
        hasContainer: true,
        stickToBottom: true,
        blocked: false,
        shouldFollow: true,
    };

    it('auto-scrolls when pinned to the bottom and a follow reason exists', () => {
        expect(shouldAutoScrollToBottom(base)).toBe(true);
    });

    it('does not auto-scroll while the user is reading older messages', () => {
        expect(shouldAutoScrollToBottom({ ...base, stickToBottom: false })).toBe(false);
    });

    it('does not auto-scroll when selection or windowed history mode blocks following', () => {
        expect(shouldAutoScrollToBottom({ ...base, blocked: true })).toBe(false);
    });

    it('does not auto-scroll when nothing new requires following', () => {
        expect(shouldAutoScrollToBottom({ ...base, shouldFollow: false })).toBe(false);
    });

    it('does not auto-scroll when the scroll container is missing', () => {
        expect(shouldAutoScrollToBottom({ ...base, hasContainer: false })).toBe(false);
    });
});

describe('shouldShowJumpToLatest', () => {
    const base = {
        stickToBottom: false,
        blocked: false,
        generating: true,
    };

    it('shows a jump-to-latest button while away from the bottom and content is generating', () => {
        expect(shouldShowJumpToLatest(base)).toBe(true);
    });

    it('hides the button when the user is back at the bottom', () => {
        expect(shouldShowJumpToLatest({ ...base, stickToBottom: true })).toBe(false);
    });

    it('hides the button when nothing is generating', () => {
        expect(shouldShowJumpToLatest({ ...base, generating: false })).toBe(false);
    });

    it('hides the button when selection or windowed history mode blocks following', () => {
        expect(shouldShowJumpToLatest({ ...base, blocked: true })).toBe(false);
    });
});

describe('resolveAutoScrollAction', () => {
    const base = {
        stickToBottom: true,
        blocked: false,
        generating: true,
    };

    it('snaps to the bottom while pinned and content is generating, instead of restarting a smooth scroll', () => {
        expect(resolveAutoScrollAction(base)).toBe('snap');
    });

    it('does nothing while the user is reading older messages', () => {
        expect(resolveAutoScrollAction({ ...base, stickToBottom: false })).toBe('none');
    });

    it('does nothing when selection or windowed history mode blocks following', () => {
        expect(resolveAutoScrollAction({ ...base, blocked: true })).toBe('none');
    });

    it('does nothing when nothing is generating', () => {
        expect(resolveAutoScrollAction({ ...base, generating: false })).toBe('none');
    });
});
