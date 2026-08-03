import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../types';
import {
  buildUserProfileBackupFields,
  DEFAULT_USER_PROFILE_ID,
  resolveUserProfileForCharacter,
  USER_PROFILE_BINDING_REMINDER,
  USER_PROFILE_PERSONA_PROMPT_LABEL,
  USER_PROFILE_PERSONA_PROMPT_PLACEHOLDER,
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

describe('persona prompt field copy', () => {
  it('uses simple wording that tells users the field is optional and AI-facing', () => {
    expect(USER_PROFILE_PERSONA_PROMPT_LABEL).toBe('给 AI 的补充说明');
    expect(USER_PROFILE_PERSONA_PROMPT_PLACEHOLDER).toContain('可以不填');
    expect(USER_PROFILE_PERSONA_PROMPT_PLACEHOLDER).toContain('请把我当成');
  });
});
