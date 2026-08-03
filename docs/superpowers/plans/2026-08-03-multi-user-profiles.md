# Multi User Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multiple editable user identities so each private chat character can use a bound user profile, while old single-profile data keeps working.

**Architecture:** Keep the existing `userProfile` as the default identity (`id: "me"`), store extra identities in the existing IndexedDB `user_profile` store, and keep `characterUserProfileBindings` as a charId-to-profileId map on the default record. Add a pure resolver so chat UI, prompt building, and future modules can ask one question: "which user profile should this character see?"

**Tech Stack:** React 18, TypeScript, IndexedDB via `utils/db.ts`, Vitest with fake-indexeddb.

---

### Task 1: Resolver And Types

**Files:**
- Modify: `types.ts`
- Create: `utils/userProfiles.ts`
- Test: `utils/userProfiles.test.ts`

- [x] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE_ID, resolveUserProfileForCharacter } from './userProfiles';
import type { UserProfile } from '../types';

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
    const resolved = resolveUserProfileForCharacter([defaultProfile, altProfile], { c1: 'persona_alt' }, 'c1', defaultProfile);
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run utils/userProfiles.test.ts`
Expected: FAIL because `utils/userProfiles.ts` does not exist.

- [x] **Step 3: Implement minimal resolver and profile metadata fields**

Add optional `id`, `label`, `personaPrompt`, `createdAt`, `updatedAt`, and `characterUserProfileBindings` to `UserProfile`. Add `utils/userProfiles.ts` with `DEFAULT_USER_PROFILE_ID`, `normalizeUserProfiles`, and `resolveUserProfileForCharacter`.

- [x] **Step 4: Run resolver tests**

Run: `pnpm exec vitest run utils/userProfiles.test.ts`
Expected: PASS.

### Task 2: DB And Backup Compatibility

**Files:**
- Modify: `utils/db.ts`
- Modify: `types.ts`
- Test: `utils/db.userProfiles.test.ts`
- Test: `utils/backupRoundtrip.test.ts`

- [x] **Step 1: Write failing DB backup tests**

Create tests that save default and alternate profiles, bind `c1` to the alternate profile, export/import backup data, and assert both profiles plus the binding survive. Also assert an old backup with only `userProfile` imports as `id: "me"`.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run utils/db.userProfiles.test.ts utils/backupRoundtrip.test.ts`
Expected: FAIL because DB has no multi-profile helpers and backup shape does not include `userProfiles`.

- [x] **Step 3: Implement DB helpers and backup fields**

Add `getUserProfiles`, `saveUserProfileById`, `deleteUserProfile`, and binding persistence through `characterUserProfileBindings` on the default profile. Add `FullBackupData.userProfiles` and `FullBackupData.characterUserProfileBindings`. Make export/import roundtrip all profile records, while keeping old `userProfile` backups valid.

- [x] **Step 4: Run DB backup tests**

Run: `pnpm exec vitest run utils/db.userProfiles.test.ts utils/backupRoundtrip.test.ts`
Expected: PASS.

### Task 3: App State And Private Chat

**Files:**
- Modify: `context/OSContext.tsx`
- Modify: `apps/Chat.tsx`
- Modify: `hooks/useChatAI.ts` only if the existing prop contract needs type updates.
- Modify: `utils/context.ts`
- Modify: `utils/chatPrompts.ts`

- [x] **Step 1: Wire OSContext state**

Load all user profiles on startup, expose `userProfiles`, `characterUserProfileBindings`, `createUserProfile`, `updateUserProfileById`, `deleteUserProfile`, `bindUserProfileToCharacter`, and `resolveUserProfileForCharacter`. Keep `userProfile` and `updateUserProfile` as the default identity API.

- [x] **Step 2: Use resolved profile in private chat**

In `apps/Chat.tsx`, compute `effectiveUserProfile = resolveUserProfileForCharacter(char.id)`, pass it to `useChatAI`, use its avatar for user bubbles, and attach `userProfileId`, `userProfileName`, and `userProfileAvatar` to newly saved user messages.

- [x] **Step 3: Include persona prompt in system context**

In `utils/context.ts`, append `personaPrompt` under the user profile block when present.

### Task 4: Profile UI

**Files:**
- Modify: `apps/UserApp.tsx`
- Modify or remove from UI: `components/user/PerCharAvatarPicker.tsx`

- [x] **Step 1: Replace one-profile editing with a profile list**

Show all identities, allow creating a new identity, selecting one, editing name/avatar/bio/personaPrompt, and deleting non-default identities.

- [x] **Step 2: Add character binding controls**

For each character, show a select control: default identity or any created identity. Saving updates `characterUserProfileBindings`.

### Task 5: Verification

**Files:**
- No new production files.

- [x] **Step 1: Run targeted tests**

Run: `pnpm exec vitest run utils/userProfiles.test.ts utils/db.userProfiles.test.ts utils/backupRoundtrip.test.ts utils/chatPrompts.quote.test.ts`
Expected: PASS.

- [x] **Step 2: Run type/build check**

Run: `pnpm run build`
Expected: PASS.
