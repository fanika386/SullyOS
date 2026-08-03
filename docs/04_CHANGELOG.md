# SullyOS AI Changelog

本文件记录适合 AI 和未来开发者阅读的项目演进，不复制 Git Log。每次任务结束前请判断是否需要追加。

## 记录模板

```markdown
## YYYY-MM-DD

本次任务：

修改内容：

新增模块：

影响模块：

是否修改业务逻辑：

是否更新 `01_PROJECT_MAP.md`：

是否更新 `02_ARCHITECTURE.md`：

后续注意：
```

## 2026-08-03 - 世界书 AI 深检 API 选择

本次任务：

优化世界书去重的 AI 深检入口，让用户在深检前直接选择本次使用的 API，并把 AI 建议改成更通俗的中文。

修改内容：

- 在 `utils/worldbook.ts` 新增世界书深检 API 选择构造逻辑，支持聊天 API、去重专用 API 和已保存 API 预设。
- 在 `apps/WorldbookApp.tsx` 的 AI 语义深检卡片增加“本次使用”选择器，并提示这是粗略扫重和修复建议，可选便宜 API。
- 调整世界书去重 AI 的系统提示和输出说明，要求短句、通俗中文，避免学术化/专业化表达。
- 在 `utils/worldbook.test.ts` 增加测试，覆盖预设选择和通俗提示词约束。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。AI 深检请求的 API 来源可由用户在世界书面板本次选择；选择预设只影响本次深检，不会改写聊天 API 配置。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次是世界书去重功能内部交互和提示词优化。

后续注意：

- AI 深检仍只发送本地检测出的候选重复对，不会自动删除、合并或改写世界书。

## 2026-08-03 - 用户档案多面具

本次任务：

把原本单一的用户档案扩展为可切换的多个用户面具，让不同 RP 身份可以使用不同名字、头像、bio 和分角色头像。

修改内容：

- 在 `types.ts` 为 `UserProfile` 增加 `id`、`label`、`personaPrompt`、`characterUserProfileBindings` 等多身份字段，并在备份结构中增加 `userProfiles`。
- 新增 `utils/userProfiles.ts`，集中处理默认身份、旧数据归一化、角色绑定解析和旧分角色头像兜底。
- 在 `utils/db.ts` 中复用既有 `user_profile` store 保存多条身份记录，旧备份的单个 `userProfile` 会导入为默认身份 `me`。
- 在 `context/OSContext.tsx` 中保留旧 `userProfile` 作为默认身份，同时向 UI 暴露 `userProfiles`、角色绑定表和统一解析函数。
- 在 `apps/UserApp.tsx` 的“我的档案”页增加面具选择、新建、删除和私聊角色绑定入口；姓名、头像、bio 和额外身份设定会作用于当前选中的面具。
- 在 `apps/Chat.tsx` 中让私聊 prompt、用户气泡头像和新用户消息 metadata 使用当前角色解析出的身份。
- 新增 `utils/userProfiles.test.ts`、`utils/db.userProfiles.test.ts`、`utils/context.userProfiles.test.ts`，覆盖绑定解析、备份导入导出和 prompt 注入。

新增模块：

- `utils/userProfiles.ts`
- `utils/userProfiles.test.ts`
- `utils/db.userProfiles.test.ts`
- `utils/context.userProfiles.test.ts`

影响模块：

- `apps/UserApp.tsx`
- `apps/Chat.tsx`
- `context/OSContext.tsx`
- `types.ts`
- `utils/db.ts`
- `utils/context.ts`

是否修改业务逻辑：

- 是。私聊按角色绑定解析用户身份；群聊、约会、主动消息、Instant Push 等暂时仍走默认身份或原有兼容路径。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次只扩展既有用户档案模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。总体架构不变，新增逻辑在 OSContext 和用户档案工具层内闭合。

后续注意：

- 旧数据会在运行时自动生成一个默认身份；未新增 IndexedDB store，不需要提升 DB version。

## 2026-08-03 - 世界书去重 AI 深检

本次任务：

在已完成的世界书本地去重检测上增加可选 AI 语义深检，并允许用户在设置里配置去重专用模型。

修改内容：

- 在 `utils/worldbook.ts` 新增 AI 深检请求构造、OpenAI 兼容接口调用和结构化 JSON 解析逻辑；只把本地检测出的候选重复对发给模型。
- 在 `apps/WorldbookApp.tsx` 增加“AI 深检”按钮和语义结论展示，区分功能重复、部分重叠、互补、冲突和无关。
- 在 `apps/Settings.tsx` 的 API 配置区域增加“世界书去重 AI”可选配置，可跟随主聊天 API，也可从已有预设选择便宜模型。
- 在 `utils/worldbook.test.ts` 增加 AI 深检单测，覆盖候选裁剪、低温度请求、JSON 解析和配置缺失报错。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `apps/Settings.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。新增世界书去重的可选 AI 深检路径；去重专用配置以运行时扩展字段保存在现有 `apiConfig` 中，不自动删除、合并或改写世界书内容，不修改 IndexedDB schema。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次只扩展世界书 App 内部功能和现有 API 配置字段，未改变总体架构。

后续注意：

- AI 深检依赖用户自己的 OpenAI 兼容接口；未配置去重专用 API 时会跟随主聊天 API，调用时固定低温度并只发送本地候选对。

## 2026-08-03 - 世界书去重检测

本次任务：

给二改分支的世界书 App 增加本地去重检测能力，先只做检测和修改建议，不做自动删除或合并。

修改内容：

- 在 `utils/worldbook.ts` 新增世界书重复分析纯函数，综合归一化文本、中文词片、关键词、分组和片段相似度，输出重复率、证据片段、重复等级和修改建议。
- 在 `apps/WorldbookApp.tsx` 增加“去重”入口、选择模式、全选 / 清空 / 按分组选取、开始检测和结果面板。
- 在 `utils/worldbook.test.ts` 增加重复检测单测，覆盖完全重复、部分重叠和无重复场景。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。新增世界书本地检测逻辑和世界书 App 交互；未修改 IndexedDB schema、世界书持久化格式或 AI prompt 注入链路。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次没有改变架构或数据流。

后续注意：

- 当前检测不调用 LLM，也不会自动改写、删除或合并世界书；如后续要加“一键合并”，需要先设计确认挂载角色同步和撤销策略。

## 2026-07-22 - 基础文档体系初始化

本次任务：

建立 SullyOS 项目基础文档体系，供后续 Codex Task、Worktree 和开发工作共用。

修改内容：

- 新增 `docs/00_READ_FIRST.md`，作为新任务入口和阅读顺序说明。
- 新增 `docs/01_PROJECT_MAP.md`，按功能映射到关键文件、Worker、工具和专项文档。
- 新增 `docs/02_ARCHITECTURE.md`，说明 local-first 架构、AI 请求链路、数据流、部署方式和扩展边界。
- 新增 `docs/03_DEVELOPMENT_RULES.md`，建立项目级开发规范、AI 链路规则、数据安全规则和文档同步规则。
- 新增 `docs/04_CHANGELOG.md`，作为后续任务可追加的 AI 维护型变更记录。

新增模块：

- `docs/00_READ_FIRST.md`
- `docs/01_PROJECT_MAP.md`
- `docs/02_ARCHITECTURE.md`
- `docs/03_DEVELOPMENT_RULES.md`
- `docs/04_CHANGELOG.md`

影响模块：

- 文档体系。未修改业务代码、构建配置、测试、Worker 或运行时代码。

是否修改业务逻辑：

- 否。

是否更新 `01_PROJECT_MAP.md`：

- 是。本次创建并填充初始项目功能地图。

是否更新 `02_ARCHITECTURE.md`：

- 是。本次创建并填充初始架构说明。

后续注意：

- 后续新增 App、Worker、AI 链路、DB store、备份格式或部署流程时，请同步更新 `01_PROJECT_MAP.md`、`02_ARCHITECTURE.md` 和本文件。
- `CLAUDE.md` 仍是专项文档导航入口；本次未替换它。

## 2026-08-02 - 固化二改分支部署流程

本次任务：

记录用户 SullyOS 二改分支、Cloudflare 预览地址和后续 Codex Task 的默认收尾流程。

修改内容：

- 更新 `docs/00_READ_FIRST.md`，新增二改工作流入口，明确 `master` 是原版 Production，`sullyos-remix` 是用户二改分支。
- 更新 `docs/03_DEVELOPMENT_RULES.md`，新增用户二改分支与 Cloudflare 规则，要求二改默认在 `sullyos-remix` 修改、验证、commit、push。

新增模块：

- 无。

影响模块：

- 文档体系。未修改业务代码、构建配置、测试、Worker 或运行时代码。

是否修改业务逻辑：

- 否。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次没有改变架构或数据流，只固化现有分支部署工作流。

后续注意：

- 新任务如果是用户二改，先确认当前分支是 `sullyos-remix`。
- push 到 `sullyos-remix` 后，Cloudflare Pages 会自动更新 `https://sullyos-remix.sullyos-5fy.pages.dev/`。

## 2026-07-22 - 文档规则完善

本次任务：

完善项目基础文档体系，让它更适合作为长期开发规范。

修改内容：

- 更新 `docs/00_READ_FIRST.md`，明确所有新 Task / 新 Worktree 的固定基础阅读顺序：`00_READ_FIRST` -> `01_PROJECT_MAP` -> `02_ARCHITECTURE` -> `03_DEVELOPMENT_RULES`。
- 更新 `docs/01_PROJECT_MAP.md`，增加高层模块状态速览，用于快速判断稳定维护区、持续演进区和资料留存区。
- 更新 `docs/03_DEVELOPMENT_RULES.md`，新增 Task 完成标准（Definition of Done）。
- 收紧基础 docs 更新条件：只有新增模块、删除模块、移动目录、修改项目架构、修改数据流、修改 AI 调用链、修改部署方式、修改数据模型时才需要同步更新基础 docs。
- 增加文档维护质量规则，避免普通 Bug 修复、样式调整、小范围逻辑修改制造无意义文档噪音。

新增模块：

- 无。

影响模块：

- 文档体系。未修改业务代码、构建配置、测试、Worker 或运行时代码。

是否修改业务逻辑：

- 否。

是否更新 `01_PROJECT_MAP.md`：

- 是。新增高层模块状态速览和状态口径。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次没有改变架构事实，只完善开发规范和文档维护规则。

后续注意：

- 后续 Task 完成时应先判断是否触发基础 docs 更新条件；未触发时不要强行追加 changelog。
- 模块状态只维护主要模块级别，避免状态表本身变成新的维护负担。
