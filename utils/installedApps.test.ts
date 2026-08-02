import { describe, expect, it } from 'vitest';
import { INSTALLED_APPS } from '../constants';
import { AppID } from '../types';

describe('installed desktop apps', () => {
    it('does not show pruned low-use apps in the launcher', () => {
        const visibleIds = new Set(INSTALLED_APPS.map(app => app.id));

        expect(visibleIds.has(AppID.Novel)).toBe(false);
        expect(visibleIds.has(AppID.Songwriting)).toBe(false);
        expect(visibleIds.has(AppID.VRWorld)).toBe(false);
        expect(visibleIds.has(AppID.Schedule)).toBe(false);
    });
});
