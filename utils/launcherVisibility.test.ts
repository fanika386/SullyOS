import { describe, expect, it } from 'vitest';
import { normalizeLauncherPinwheelOrder, shouldShowLauncherScheduleWidget } from './launcherVisibility';

describe('launcher visibility helpers', () => {
    it('does not expose the music widget when music is pruned', () => {
        expect(normalizeLauncherPinwheelOrder(['music', 'appsA', 'appsB', 'image'])).not.toContain('music');
    });

    it('does not expose the schedule widget when schedule is pruned', () => {
        expect(shouldShowLauncherScheduleWidget()).toBe(false);
    });
});
