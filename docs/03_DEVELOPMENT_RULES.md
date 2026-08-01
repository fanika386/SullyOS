# SullyOS Development Rules

本文件是项目级开发规范。除非用户明确要求，否则所有 Task 都应遵守这些规则。

## 开始任务前

1. 先读 `docs/00_READ_FIRST.md`。
2. 按任务范围读 `docs/01_PROJECT_MAP.md` 和 `docs/02_ARCHITECTURE.md`。
3. 通过 `CLAUDE.md` 找到相关专项文档。
4. 检查当前分支和工作区状态。
5. 明确本次任务目标，不把无关重构混进来。

不要跳过项目文档直接开发。

## 包管理和命令

- 统一使用 `pnpm`。不要改用 `npm` 或 `yarn`。
- 安装依赖：`pnpm install`
- 本地开发：`pnpm dev`
- 正式构建：`pnpm run build`
- Worker 产物构建：`pnpm run build:workers`
- 测试：`pnpm test:run` 或 `pnpm vitest run <file>`
- 预览：`pnpm preview`

`pnpm run build` 会先跑 Worker 构建再跑 Vite 构建。涉及 Worker / Service Worker 源码时，要确认生成产物是否需要同步。

## 修改范围

- 只改本次任务需要的文件。
- 不做无关格式化、重命名、目录搬迁或风格统一。
- 不删除已有文件，除非用户明确要求并且确认风险。
- 不回滚工作区里自己没有做的改动。
- 不把一次任务拆成多个隐式目标。

## Task 完成标准

Task 不以“代码写完”作为完成标准。默认完成流程是：

```text
开始开发
  -> 阅读 docs/00_READ_FIRST.md
  -> 按顺序阅读 01_PROJECT_MAP / 02_ARCHITECTURE / 03_DEVELOPMENT_RULES
  -> 读取任务相关专项文档
  -> 开发或文档修改
  -> 按风险运行测试 / 构建 / 针对性验证
  -> 判断是否触发 docs 更新条件
  -> 必要时同步更新 docs
  -> 检查 git status
  -> 汇报结果、验证证据和未做事项
  -> Task 完成
```

完成前必须确认：

- 本次目标已经覆盖，没有把用户要求的一部分留到“以后再说”。
- 验证方式与风险匹配。文档-only 改动至少检查文件内容和 Git 状态；代码改动按影响范围跑测试或构建。
- 如果修改影响项目结构、架构、AI 调用链、部署或数据模型，已同步更新基础 docs。
- 工作区状态已检查，并明确哪些变更是本次产生的、哪些是原本存在的。
- 最终回复说明实际做了什么、验证了什么、没有做什么。

不要把“能编译”当作唯一完成标准。对这个项目来说，数据兼容、AI 链路一致性、部署说明和后续 Task 可维护性同样是完成标准的一部分。

## 新功能放哪里

新增桌面 App

- 新建 `apps/YourApp.tsx`。
- 在 `types.ts` 的 `AppID` 增加稳定 ID。
- 在 `constants.tsx` 的 `INSTALLED_APPS` 注册名称、图标、颜色。
- 在 `components/PhoneShell.tsx` 的 lazy import、`APP_BY_ID` 和 `renderApp()` 接入。
- 如需按下预取，检查 `components/os/appPreload.ts`。
- 更新 `docs/01_PROJECT_MAP.md` 和 `docs/04_CHANGELOG.md`。

新增共享业务逻辑

- 放到 `utils/` 或 `utils/<domain>/`。
- UI 组件只保留交互状态和轻量编排。
- 纯函数、解析器、数据格式转换优先写单测。

新增 prompt 或 AI 模式

- 私聊主链路必须优先复用 `utils/chatRequestPayload.ts`。
- 核心身份上下文必须优先复用 `ContextBuilder`，不要重复拼一套记忆和人设。
- 领域 prompt 放在对应文件，例如 `utils/datePrompts.ts`、`utils/groupChat/prompts.ts`、`utils/songPrompts.ts`、`utils/vrWorld/prompts.ts`。
- 新模式如果会影响正常聊天、主动消息或 Instant Push，要确认这些路径是否都需要同样上下文。

新增数据

- 少量本机设置可放 localStorage，但重要设置应考虑 `utils/lsMirror.ts` 镜像。
- 用户内容、消息、角色、世界、长期状态应进 IndexedDB。
- 改 `utils/db.ts` 时必须保证老用户升级兼容，store 创建和索引补建应幂等。
- 大图和二进制素材优先使用 Blob 引用，不要把 base64 长期塞进 JSON。
- 改备份导入导出时，必须检查 `utils/backupFormat.ts`、`utils/backupExport.ts`、`utils/backupImportPolicy.ts` 和相关测试。

新增 Worker / 后端能力

- Cloudflare Worker 放到 `worker/<name>/`。
- 需要 wrangler 部署的写清 `wrangler.toml` 和 README。
- 需要随前端 build 生成 bundle 的，加入 `scripts/build-workers.mjs` 的 manifest。
- 不要手工编辑生成的 `worker.bundle.js` 或 `public/*worker*.bundle.js`。
- 更新部署说明和 `docs/01_PROJECT_MAP.md`。

## AI 链路规则

- 不要绕开 `buildChatRequestPayload()` 直接拼私聊请求。
- 不要在多个文件复制相同 system prompt 块。
- 不要重复造长期记忆检索。记忆宫殿和传统记忆已经通过 `ContextBuilder` / `injectMemoryPalace` 接入。
- 不要把图片 base64、卡片 JSON、工具原始结果无控制地塞进 prompt。已有代码对群聊、图片、多模态和卡片有压缩 / 占位策略。
- 工具调用、内联 directive 和副作用应走现有 parser / bridge / post-processing，不要让 LLM 输出直接变成未经处理的 UI 状态。

## UI 规则

- 保持现有 App 的视觉语言和交互密度，不为小改动引入全新设计体系。
- 已迁移安全区的 App 自己处理 `--safe-*` / `--chrome-top`；未迁移 App 由外壳兜底。改安全区前先看 `utils/safeAreaApps.ts`。
- 复杂 App 优先拆子组件或领域 utils，但不要为一次小修做大规模重构。
- App 运行错误应由现有错误边界和 toast / error dialog 体系承接。

## 测试规则

- 文档-only 改动通常不需要跑完整测试，但要检查工作区只包含目标文档变更。
- 改纯函数、parser、prompt 工具、备份格式、DB 迁移、push 决策时，应添加或更新 Vitest。
- 改 `utils/db.ts`、备份导入导出、Memory Palace、Instant Push、Service Worker 时，测试范围要更宽。
- 如果测试因为环境或依赖无法运行，结束时说明未运行原因。

## 部署规则

- 前端静态构建输出为 `dist/`。
- GitHub Pages workflow 使用 `pnpm run build`，并设置 `GITHUB_PAGES=true` 让 Vite 使用相对 base。
- Vercel 配置当前是 `vite build` + `dist` + SPA fallback。
- Netlify 配置当前是 `dist` + `netlify/functions` + `/api/v1/*` redirect。
- Cloudflare Worker 是可选后端能力，不是所有部署都必须启用。
- 二改发布时要按 README 替换自己的 Worker / 代理，不要默认占用作者公共实例。

## 文档同步规则

任何 Task 在结束之前，都必须检查：

- 是否需要更新 `docs/01_PROJECT_MAP.md`
- 是否需要更新 `docs/02_ARCHITECTURE.md`
- 是否需要更新 `docs/04_CHANGELOG.md`

只有以下情况需要同步更新基础 docs：

- 新增模块
- 删除模块
- 移动目录
- 修改项目架构
- 修改数据流
- 修改 AI 调用链
- 修改部署方式
- 修改数据模型

普通 Bug 修复、样式调整、小范围逻辑修改一般不需要更新基础 docs。文档更新应该记录长期事实，不应该把一次性排障过程、临时实现细节或低影响小修塞进去。

具体更新位置：

- 新增、删除、移动重要模块或目录：更新 `01_PROJECT_MAP.md`。
- 改变数据流、AI 链路、部署方式、Worker 契约、状态边界或数据模型：更新 `02_ARCHITECTURE.md`。
- 新增或调整长期开发规则：更新 `03_DEVELOPMENT_RULES.md`。
- 有长期协作价值的结构性任务：追加 `04_CHANGELOG.md`。
- 新增专项文档：在 `CLAUDE.md` 或 `01_PROJECT_MAP.md` 加入口。

不要等别人提醒，也不要为了完成 checklist 强行制造文档变更。

## 文档维护质量规则

- 基础 docs 只记录长期事实：模块位置、架构边界、数据流、AI 链路、部署方式、开发规则和维护状态。
- 不把一次性排障过程、临时尝试、个人推测或低影响小修写进基础 docs；这些内容如果确实有价值，优先放到专项文档或最终回复。
- `01_PROJECT_MAP.md` 的状态只维护到主要模块级别，避免给每个文件贴状态导致文档很快过期。
- 如果本次任务没有触发 docs 更新条件，最终回复可以直接说明“未触发基础 docs 更新条件”，不需要为小改动追加 changelog。
- 如果发现文档与代码不一致，优先核对当前代码，再修正文档；不要为了保留旧说明而让新 Task 继续读错信息。

## Changelog 记录要求

`docs/04_CHANGELOG.md` 不是 Git Log。它记录的是 AI 和开发者需要知道的项目演进事实。

每条记录至少包含：

- 日期
- 本次任务
- 修改内容
- 新增模块
- 影响模块
- 是否修改业务逻辑
- 是否更新 `01_PROJECT_MAP.md`
- 是否更新 `02_ARCHITECTURE.md`
- 后续注意

如果任务只是微小文案、注释或无长期影响的局部修复，可以在最终说明中解释为什么不追加 changelog。
