import { beforeEach, describe, expect, it } from 'vitest';
import { DB } from './db';
import { DEFAULT_USER_PROFILE_ID } from './userProfiles';
import type { FullBackupData, UserProfile } from '../types';

const defaultProfile: UserProfile = {
  id: DEFAULT_USER_PROFILE_ID,
  name: '默认我',
  avatar: 'default.png',
  bio: '默认设定',
  characterUserProfileBindings: { c1: 'persona_alt' },
};

const altProfile: UserProfile = {
  id: 'persona_alt',
  name: '面具我',
  avatar: 'alt.png',
  bio: '面具设定',
  personaPrompt: '只在这个面具里出现的补充设定',
};

beforeEach(async () => {
  await DB.deleteDB();
});

describe('DB user profiles', () => {
  it('roundtrips multiple profiles and character bindings through backup import/export', async () => {
    await DB.saveUserProfile(defaultProfile);
    await DB.saveUserProfileById(altProfile);

    const exported = await DB.exportFullData();

    expect(exported.userProfiles?.map(profile => profile.id).sort()).toEqual([
      DEFAULT_USER_PROFILE_ID,
      'persona_alt',
    ]);
    expect(exported.characterUserProfileBindings).toEqual({ c1: 'persona_alt' });

    await DB.deleteDB();
    await DB.importFullData(exported as FullBackupData);

    const restoredProfiles = await DB.getUserProfiles();
    expect(restoredProfiles.map(profile => profile.id).sort()).toEqual([
      DEFAULT_USER_PROFILE_ID,
      'persona_alt',
    ]);
    expect(restoredProfiles.find(profile => profile.id === 'persona_alt')?.name).toBe('面具我');
    expect((await DB.getUserProfile())?.characterUserProfileBindings).toEqual({ c1: 'persona_alt' });
  });

  it('imports an old backup with a single userProfile as the default profile', async () => {
    await DB.importFullData({
      timestamp: Date.now(),
      version: 1,
      userProfile: {
        name: '旧版我',
        avatar: 'legacy.png',
        bio: '旧版设定',
      },
    } as FullBackupData);

    const profiles = await DB.getUserProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: DEFAULT_USER_PROFILE_ID,
      name: '旧版我',
      avatar: 'legacy.png',
      bio: '旧版设定',
    });
  });
});
