# SullyOS Task Onboarding

欢迎来到 SullyOS 项目。这个仓库是一个运行在浏览器里的虚拟手机系统：React + TypeScript + Vite 前端，数据默认保存在用户本机 IndexedDB，并通过可选 Worker / Serverless 代理接入联网、备份、推送、TTS、音乐、小红书和 MCP 等能力。

这组文档是给所有新 Codex Task、Worktree 和未来开发者的入口。目标是让后续任务先共享同一套项目事实，再开始改动，减少重复扫描和误改。

## 开始前必须读

新 Task / 新 Worktree 不要直接开发。所有任务先完成下面固定基础阅读顺序：

1. `docs/00_READ_FIRST.md`：确认当前任务的阅读入口和工作边界。
2. `docs/01_PROJECT_MAP.md`：按功能找到相关文件，不要只靠全文搜索乱跳。
3. `docs/02_ARCHITECTURE.md`：理解核心数据流、AI 请求链路、部署方式和不建议随意改的模块。
4. `docs/03_DEVELOPMENT_RULES.md`：确认开发规则、文档同步规则、测试和部署注意事项。

完成基础阅读后，再开始开发前的定位和实现。不要把“已经知道大概项目结构”当作跳过基础文档的理由。

如果任务明确涉及某个专题，继续阅读 `CLAUDE.md` 指向的专项文档。例：改记忆宫殿前读 `docs/memory-system-overview.md`；改 Instant Push 前读 `docs/instant-push-dual-channel.md` 和 `docs/instant-push-branch-notes.md`。

如果任务涉及产品能力、二改、运行方式或部署注意，再读 `README.md` 的相关章节。

## 二改工作流

本仓库当前用于用户二改时，默认在同一个 GitHub repo `fanika386/SullyOS` 内工作：

- `master`：原版 / Production 分支，对应 Cloudflare 正式地址 `https://sullyos-5fy.pages.dev/`。
- `sullyos-remix`：用户二改分支，对应 Cloudflare 分支预览地址 `https://sullyos-remix.sullyos-5fy.pages.dev/`。

二改不是另一个独立 repo，而是同一 repo 的独立分支。新 Task 如果用户要改二改版，先确认当前分支是 `sullyos-remix`，不要把二改提交混进 `master`，除非用户明确要求把二改提升到正式版。

二改默认收尾流程：

1. 检查 `git status --short` 和当前分支。
2. 按任务修改并做风险匹配的验证。
3. 检查 diff / status。
4. `git add`、`git commit`、`git push` 到 `sullyos-remix`。
5. 等 Cloudflare Pages 自动更新二改预览地址。

## 开发前检查

开始任何修改前，至少确认：

- 当前 Git 分支：`git branch --show-current`
- 当前任务目标：本次只做用户要求的范围，不把顺手重构塞进去。
- 当前工作区状态：`git status --short`
- 是否已有用户改动：不要回滚或覆盖自己没有做的改动。
- 是否需要先读专项文档：看 `CLAUDE.md` 和 `docs/01_PROJECT_MAP.md`。

## 本项目的基本事实

- 包管理器：仓库已有 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml`，项目导航要求统一使用 `pnpm`。
- 本地开发：`pnpm install` 后运行 `pnpm dev`，Vite 默认端口是 `5173`。
- 正式前端构建：`pnpm run build`，脚本会先执行 `pnpm run build:workers`，再执行 `vite build`，输出到 `dist/`。
- 预览构建产物：`pnpm preview`。
- 测试：`pnpm test:run` 或针对性运行 Vitest。
- 移动端：通过 Capacitor 同步和打开 Android 工程，脚本是 `pnpm cap:sync`、`pnpm cap:android`。

## 工作边界提醒

SullyOS 是 local-first 应用。聊天记录、角色、世界书、相册、主题和大量玩法状态都保存在用户本机。涉及 `utils/db.ts`、备份导入导出、Service Worker、Instant Push、Memory Palace、AI prompt 拼装时，必须把数据安全和向后兼容放在第一位。

不要在没有明确需求时：

- 移动核心模块位置。
- 重写 `OSContext`、`utils/db.ts` 或 AI prompt 主链路。
- 手改 `worker/*.bundle.js` 或 `public/*worker*.bundle.js` 这类生成物。
- 绕开 `ContextBuilder` / `buildChatRequestPayload` 自己拼一条平行聊天链路。
- 删除已有文档、Worker、脚本、公开素材或兼容逻辑。

## 任务结束前必须做

任何 Task 在结束前都要检查：

- 是否需要更新 `docs/01_PROJECT_MAP.md`
- 是否需要更新 `docs/02_ARCHITECTURE.md`
- 是否需要更新 `docs/04_CHANGELOG.md`

只有本次任务涉及以下变化时，才需要同步更新基础 docs：新增模块、删除模块、移动目录、修改项目架构、修改数据流、修改 AI 调用链、修改部署方式、修改数据模型。

普通 Bug 修复、样式调整、小范围逻辑修改一般不需要更新基础 docs。不要为了“显得完整”制造无意义文档噪音。
