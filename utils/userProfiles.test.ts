import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../types';
import {
  buildUserProfileBackupFields,
  DEFAULT_USER_PROFILE_ID,
  getUserProfileInstructionText,
  resolveUserProfileForCharacter,
  USER_PROFILE_BIO_LABEL,
  USER_PROFILE_BIO_PLACEHOLDER,
  USER_PROFILE_BINDING_REMINDER,
} from './userProfiles';

const defaultProfile: UserProfile = {
  id: DEFAULT_USER_PROFILE_ID,
  name: '默认我',
  avatar: 'default.png',
  bio: '默认设定',
  perCharAvatars: { c2: 'legacy-c2.png' },
};

const altProfile: UserProfile = {
  id: 'persona_alt',
  name: '面具我',
  avatar: 'alt.png',
  bio: '面具设定',
  personaPrompt: '只在这个面具里出现的补充设定',
};

describe('resolveUserProfileForCharacter', () => {
  it('returns the bound profile for a character', () => {
    const resolved = resolveUserProfileForCharacter(
      [defaultProfile, altProfile],
      { c1: 'persona_alt' },
      'c1',
      defaultProfile,
    );

    expect(resolved.name).toBe('面具我');
    expect(resolved.bio).toBe('面具设定');
    expect(resolved.personaPrompt).toContain('补充设定');
  });

  it('falls back to the default profile when a character is unbound or bound to a missing id', () => {
    expect(resolveUserProfileForCharacter([defaultProfile, altProfile], {}, 'c1', defaultProfile).name).toBe('默认我');
    expect(resolveUserProfileForCharacter([defaultProfile, altProfile], { c1: 'missing' }, 'c1', defaultProfile).name).toBe('默认我');
  });

  it('keeps legacy per-character avatar overrides on the resolved profile', () => {
    const resolved = resolveUserProfileForCharacter([defaultProfile, altProfile], {}, 'c2', defaultProfile);

    expect(resolved.avatar).toBe('legacy-c2.png');
  });
});

describe('buildUserProfileBackupFields', () => {
  it('exports all profile records and the default profile binding map', () => {
    const fields = buildUserProfileBackupFields([
      { ...altProfile, id: 'persona_alt' },
      {
        ...defaultProfile,
        id: DEFAULT_USER_PROFILE_ID,
        characterUserProfileBindings: { c1: 'persona_alt' },
      },
    ]);

    expect(fields.userProfile?.id).toBe(DEFAULT_USER_PROFILE_ID);
    expect(fields.userProfile?.name).toBe('默认我');
    expect(fields.userProfiles?.map(profile => profile.id).sort()).toEqual([
      DEFAULT_USER_PROFILE_ID,
      'persona_alt',
    ]);
    expect(fields.characterUserProfileBindings).toEqual({ c1: 'persona_alt' });
  });
});

describe('USER_PROFILE_BINDING_REMINDER', () => {
  it('warns users to avoid frequent persona rebinding', () => {
    expect(USER_PROFILE_BINDING_REMINDER).toContain('尽量不要频繁切换');
    expect(USER_PROFILE_BINDING_REMINDER).toContain('其它功能');
  });
});

describe('user profile setting copy', () => {
  it('uses one simple optional field for the persona setting', () => {
    expect(USER_PROFILE_BIO_LABEL).toBe('面具设定');
    expect(USER_PROFILE_BIO_PLACEHOLDER).toContain('可以不填');
    expect(USER_PROFILE_BIO_PLACEHOLDER).toContain('你是谁');
    expect(USER_PROFILE_BIO_PLACEHOLDER).toContain('进阶');
  });
});

describe('getUserProfileInstructionText', () => {
  it('folds legacy personaPrompt into the single user profile setting text', () => {
    expect(getUserProfileInstructionText({
      bio: '我叫林夏，是青梅竹马。',
      personaPrompt: '请把我当成林夏，我们已经认识很久。',
    } as UserProfile)).toBe('我叫林夏，是青梅竹马。\n\n请把我当成林夏，我们已经认识很久。');
  });

  it('falls back to legacy personaPrompt when bio is empty', () => {
    expect(getUserProfileInstructionText({
      bio: '',
      personaPrompt: '请把我当成旁白。',
    } as UserProfile)).toBe('请把我当成旁白。');
  });

  it('does not duplicate legacy personaPrompt already written into bio', () => {
    expect(getUserProfileInstructionText({
      bio: '我叫林夏。\n\n请把我当成林夏。',
      personaPrompt: '请把我当成林夏。',
    } as UserProfile)).toBe('我叫林夏。\n\n请把我当成林夏。');
  });
});
