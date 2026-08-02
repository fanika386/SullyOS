import { describe, expect, it } from 'vitest';
import { INSTALLED_APPS } from '../constants';
import { AppID } from '../types';

describe('installed desktop apps', () => {
    it('does not show pruned low-use apps in the launcher', () => {
        const visibleIds = new Set(INSTALLED_APPS.map(app => app.id));
        const prunedIds = [
            AppID.Novel,
            AppID.Songwriting,
            AppID.VRWorld,
            AppID.Schedule,
            AppID.Game,
            AppID.Gallery,
            AppID.XhsStock,
            AppID.Guidebook,
            AppID.LifeSim,
            AppID.SpecialMoments,
            AppID.Music,
            AppID.CharCreatorDev,
        ];

        for (const appId of prunedIds) {
            expect(visibleIds.has(appId)).toBe(false);
        }
    });
});
