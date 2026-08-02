## SullyOS Remix Safety Rules

This workspace has two live meanings:

- `master` is the original / production branch. It maps to `https://sullyos-5fy.pages.dev/`.
- `sullyos-remix` is the user's remix branch. It maps to `https://sullyos-remix.sullyos-5fy.pages.dev/`.

For any user-requested remix work, the default branch must be `sullyos-remix`. Do not apply remix edits to `master`, do not sync remix edits into `/Users/fanyijia1205/Documents/SullyOS`, and do not push `master` unless the user explicitly asks to promote or merge the remix into production.

Before editing, committing, pushing, or discussing deployment, run:

```sh
git branch --show-current
git status -sb
pnpm run guard:remix
```

If the current branch is not `sullyos-remix`, stop and report the mismatch instead of patching files.

Cloudflare Pages is the deployment source for the remix preview. Do not treat GitHub Pages, Vercel, Netlify, or a local dev server as the remix deployment target unless the user explicitly changes the deployment setup.

Do not edit `.github/workflows/deploy-pages.yml` as a way to deploy the remix. That workflow is for GitHub Pages, not the established Cloudflare Pages remix preview.
