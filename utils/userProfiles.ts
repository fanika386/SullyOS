import type { UserProfile } from '../types';

export const DEFAULT_USER_PROFILE_ID = 'me';

const generatedProfileId = (index: number) => `persona_import_${index + 1}`;

export const withUserProfileId = (
  profile: UserProfile,
  fallbackId: string = DEFAULT_USER_PROFILE_ID,
): UserProfile => ({
  ...profile,
  id: profile.id || fallbackId,
});

export const normalizeUserProfiles = (
  profiles: Array<UserProfile | null | undefined> = [],
  fallbackProfile?: UserProfile | null,
): UserProfile[] => {
  const byId = new Map<string, UserProfile>();

  profiles.filter(Boolean).forEach((profile, index) => {
    const fallbackId = index === 0 ? DEFAULT_USER_PROFILE_ID : generatedProfileId(index);
    const normalized = withUserProfileId(profile as UserProfile, fallbackId);
    byId.set(normalized.id!, normalized);
  });

  if (!byId.has(DEFAULT_USER_PROFILE_ID) && fallbackProfile) {
    byId.set(DEFAULT_USER_PROFILE_ID, withUserProfileId(fallbackProfile, DEFAULT_USER_PROFILE_ID));
  }

  const result = Array.from(byId.values());
  result.sort((a, b) => {
    if (a.id === DEFAULT_USER_PROFILE_ID) return -1;
    if (b.id === DEFAULT_USER_PROFILE_ID) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  return result;
};

export const getDefaultUserProfile = (
  profiles: UserProfile[],
  fallbackProfile: UserProfile,
): UserProfile => {
  return profiles.find(profile => profile.id === DEFAULT_USER_PROFILE_ID)
    || profiles[0]
    || withUserProfileId(fallbackProfile, DEFAULT_USER_PROFILE_ID);
};

export const resolveUserProfileForCharacter = (
  profiles: UserProfile[],
  characterUserProfileBindings: Record<string, string> | undefined,
  charId: string | undefined,
  fallbackProfile: UserProfile,
): UserProfile => {
  const normalizedProfiles = normalizeUserProfiles(profiles, fallbackProfile);
  const defaultProfile = getDefaultUserProfile(normalizedProfiles, fallbackProfile);
  const boundProfileId = charId ? characterUserProfileBindings?.[charId] : undefined;
  const boundProfile = boundProfileId
    ? normalizedProfiles.find(profile => profile.id === boundProfileId)
    : undefined;
  const baseProfile = boundProfile || defaultProfile;
  const avatarOverride = charId ? baseProfile.perCharAvatars?.[charId] : undefined;

  return avatarOverride ? { ...baseProfile, avatar: avatarOverride } : baseProfile;
};

export const buildUserProfileBackupFields = (
  profiles: Array<UserProfile | null | undefined>,
): {
  userProfile?: UserProfile;
  userProfiles?: UserProfile[];
  characterUserProfileBindings?: Record<string, string>;
} => {
  const normalizedProfiles = normalizeUserProfiles(profiles);
  const defaultProfile = normalizedProfiles.find(profile => profile.id === DEFAULT_USER_PROFILE_ID)
    || normalizedProfiles[0];

  return {
    userProfile: defaultProfile,
    userProfiles: normalizedProfiles.length > 0 ? normalizedProfiles : undefined,
    characterUserProfileBindings: defaultProfile?.characterUserProfileBindings,
  };
};
