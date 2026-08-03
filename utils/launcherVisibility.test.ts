import { describe, expect, it } from 'vitest';
import {
    normalizeLauncherPinwheelOrder,
    shouldShowLauncherAppearanceEntrypoints,
    shouldShowLauncherDateEntrypoints,
    shouldShowLauncherRoomEntrypoints,
    shouldShowLauncherScheduleWidget,
} from './launcherVisibility';

describe('launcher visibility helpers', () => {
    it('does not expose the music widget when music is pruned', () => {
        expect(normalizeLauncherPinwheelOrder(['music', 'appsA', 'appsB', 'image'])).not.toContain('music');
    });

    it('keeps appearance image entrypoints when appearance is available', () => {
        expect(normalizeLauncherPinwheelOrder(['image', 'appsA', 'appsB'])).toContain('image');
        expect(shouldShowLauncherAppearanceEntrypoints()).toBe(true);
    });

    it('does not expose the schedule widget when schedule is pruned', () => {
        expect(shouldShowLauncherScheduleWidget()).toBe(false);
    });

    it('does not expose date entrypoints when date is pruned', () => {
        expect(shouldShowLauncherDateEntrypoints()).toBe(false);
    });

    it('does not expose room entrypoints when room is pruned', () => {
        expect(shouldShowLauncherRoomEntrypoints()).toBe(false);
    });
});
