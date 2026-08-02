import { describe, expect, it } from 'vitest';
import { normalizeLauncherPinwheelOrder } from './launcherVisibility';

describe('launcher visibility helpers', () => {
    it('does not expose the music widget when music is pruned', () => {
        expect(normalizeLauncherPinwheelOrder(['music', 'appsA', 'appsB', 'image'])).not.toContain('music');
    });
});
