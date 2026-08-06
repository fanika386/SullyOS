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

## 2026-08-06 - 清理遗留的「世界书去重专用 API」配置字段

本次任务：

用户确认「世界书去重专用 API」配置已不可见、不再使用，因此把旧版设置页遗留在本机 `apiConfig`（`os_api_config`）里的 `worldbookDedupeApi` 字段彻底清理掉，避免残留数据继续出现在配置备份里。

修改内容：

- 在 `context/OSContext.tsx` 新增 `stripLegacyWorldbookDedupeApi` 清理函数。
- 启动加载 `os_api_config` 时剥离该字段，并把清理后的配置写回 localStorage。
- `updateApiConfig` 保存前统一剥离该字段，覆盖设置保存、备份恢复等所有写入路径。

新增模块：

- 无。

影响模块：

- `context/OSContext.tsx`

是否修改业务逻辑：

- 否。该字段已无任何读取方，清理只删除无效遗留数据。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次是数据清理，不涉及架构变更。

后续注意：

- 老用户的本地配置会在下次启动时自动清理一次；备份恢复时若旧备份仍带该字段，也会在恢复时被剥离。

## 2026-08-06 - 记忆宫殿去重任务按角色隔离，多角色的结果互不覆盖

本次任务：

用户反馈记忆宫殿去重里「本机」结果只有一个槽位：A 角色还有未处理的去重候选时，在 B 角色开新扫描会提示覆盖。需求是各角色独立、互不影响。

修改内容：

- `utils/memoryPalace/dedupTaskStore.ts`：从单个任务槽升级为按扫描范围（目前即角色）隔离的多任务表，localStorage 键升级为 `sullyos.memoryPalace.dedupTasks.v2`，旧 `dedupTask.v1` 单任务数据自动迁移。
- 新扫描只替换同一角色的任务，不再清掉其他角色的进度 / 候选 / 结果；删除确认时也只更新当前角色自己的任务。
- `apps/MemoryPalaceApp.tsx`：去掉「其他角色还有未处理结果会覆盖」的确认弹窗；完成 toast 跳转改为按任务范围定位到对应角色；「清除本次结果」只清除当前角色的结果。
- 补测试：不同角色的去重任务互不影响、`resetForChar` 只清当前角色。

新增模块：

- 无。

影响模块：

- `apps/MemoryPalaceApp.tsx`
- `utils/memoryPalace/dedupTaskStore.ts`
- `utils/memoryPalace/dedupTaskStore.test.ts`
- `utils/memoryPalace/index.ts`

是否修改业务逻辑：

- 是。不同角色可同时保留各自的去重扫描 / 候选 / 结果，互不覆盖；同一角色内重新扫描仍会替换该角色自己的旧结果。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。仍是记忆宫殿去重功能内部的状态管理调整。

后续注意：

- 老用户的旧版单任务数据会在首次加载时迁移进 v2 多任务表，迁移后旧键自动删除。

## 2026-08-05 - 世界书去重 AI 选择简化：去掉去重专用配置，改为模型/预设单选

本次任务：

按用户反馈简化世界书 AI 深检的 API 选择：不再保留「去重专用 API 配置」，深检直接复用聊天 API；提供一个持久化的 API/模型单选，支持从聊天 API 的模型列表或已保存预设中选择，选完即保存、可测试、直接用于深检，不再需要额外选「本次使用」。

修改内容：

- `utils/worldbook.ts`：`buildWorldbookDedupeAiApiChoices` 移除 `dedicatedApi`（去重专用）逻辑，新增 `availableModels` 支持，为聊天 API 展开多个模型选项；之前保存过的聊天模型即使暂时不在模型列表里也会保留，避免静默跳回默认模型。
- `apps/WorldbookApp.tsx`：删除「去重专用 API 配置（可选）」折叠块及其状态/保存/测试逻辑；把「本次使用」下拉框改为「使用的 API / 模型」单选，选择后写入 `localStorage`（`os_worldbook_dedupe_ai_choice`），并提供「刷新模型列表」与「测试连接」。
- `utils/worldbook.test.ts`：更新预设选择测试，新增聊天 API 模型列表与已保存模型回退测试。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。去重专用 API 配置入口被移除，AI 深检只使用聊天 API 或已保存预设；选择持久化到本地，不再每次手动选「本次使用」。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次仍属于世界书去重功能内部交互调整。

后续注意：

- 旧版 `apiConfig.worldbookDedupeApi` 若已有数据会留在原字段但不再被读取；用户可在新的单选里直接选当前 API 模型或任意预设。

## 2026-08-05 - 世界书去重专用 API 配置移入世界书 App

本次任务：

把设置页「API 配置」里的「世界书去重 AI」配置移除，改为在世界书 App 的「AI 深度检查」面板内配置，参考记忆宫殿在 App 内管理副 API 的方式。

修改内容：

- 删除 `apps/Settings.tsx` 中「世界书去重 AI」整块配置（开关、预设选择、URL/Key/Model）及相关状态与保存逻辑。
- 在 `apps/WorldbookApp.tsx` 的「AI 深度检查」面板内新增可折叠的「去重专用 API 配置（可选）」：开关、从 API 预设导入、URL/Key/Model 输入、保存与测试连接。
- 配置仍保存在原 `apiConfig.worldbookDedupeApi` 字段，已有用户配置无需迁移，保存后会自动出现在「本次使用」下拉框的「去重专用」选项。

新增模块：

- 无。

影响模块：

- `apps/Settings.tsx`
- `apps/WorldbookApp.tsx`

是否修改业务逻辑：

- 是。配置入口和保存按钮从设置页迁移到世界书 App 内；存储字段与 AI 深检读取逻辑不变。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次仍属于世界书去重功能内部交互调整。

后续注意：

- 用户在设置页不再看到该配置；如需继续使用专用模型，请到世界书 → 去重 → AI 深度检查 → 去重专用 API 配置中保存。

## 2026-08-03 - 世界书 AI 整理理由和功能分类

本次任务：

让世界书 AI 深检建议不仅告诉用户怎么改，也说明为什么改、这样改有什么好处，并按功能分类辅助后续挂载。

修改内容：

- 在 `utils/worldbook.ts` 扩展 AI 深检输出字段，新增 `functionCategory`、`reason` 和 `benefit`。
- 调整 AI 提示词，要求用简单中文说明改动理由和好处，目标是让世界书以后挂给不同角色时更方便、更清楚、更少重复。
- 要求 AI 按功能分类，例如通用世界观、角色专属设定、地点/组织设定、时间线/事件、触发关键词和写作规则。
- 在 `apps/WorldbookApp.tsx` 的 AI 深检结果中展示“归类 / 为什么改 / 好处”。
- 在 `utils/worldbook.test.ts` 增加覆盖，确认 prompt 包含功能分类和整理目的，并解析展示新增字段。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。AI 深检结果从单纯合并建议扩展为面向后续角色挂载的整理建议。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次仍属于世界书去重功能内部提示词、解析和展示。

后续注意：

- 新字段来自 AI 建议，不会自动改写世界书；用户仍需要人工确认后再编辑条目。

## 2026-08-03 - 世界书 AI 多本重复组

本次任务：

把世界书 AI 深检从单纯两两候选升级为重复组审查，三本、四本或更多本互相关联时按一组给用户建议。

修改内容：

- 在 `utils/worldbook.ts` 根据本地重复候选构建连通重复组；两本仍按一组处理，三本以上会生成 `multi_book_group`。
- AI 请求改为发送 `duplicateGroups`，每组包含真实书名、内容摘要和组内本地重复对，不再只发送 `bookA` / `bookB`。
- AI 结果解析支持组级 `findingId`，并返回 `bookIds` / `bookTitles` 给 UI 使用。
- `Book A`、`Book B`、`Book C` 等代称会按组内顺序兜底替换成真实世界书标题。
- 在 `apps/WorldbookApp.tsx` 中让 AI 深检结果卡片优先显示组内真实书名列表。
- 在 `utils/worldbook.test.ts` 增加三本重复组测试，覆盖请求结构、书名返回和 `Book C` 清洗。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。AI 深检不再只按单个候选对审查；多个互相关联的候选对会聚合成一组，用户会看到组级建议。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次仍属于世界书去重功能内部逻辑。

后续注意：

- 组级 AI 深检仍只发送本地检测出的疑似重复内容；不会自动合并、删除或改写世界书。

## 2026-08-03 - 世界书 AI 深检书名显示

本次任务：

优化世界书 AI 深检结果的可读性，避免用户在多本世界书里看到难以区分的 Book A / Book B。

修改内容：

- 在 `utils/worldbook.ts` 调整 AI 提示词，要求建议里直接使用真实世界书标题，不使用 Book A / Book B。
- 在 AI 结果解析阶段增加兜底替换：如果模型仍返回 Book A / Book B，会按对应候选对替换为原始书名。
- 在 `apps/WorldbookApp.tsx` 更新深检 API 提示文案，说明默认跟随聊天模型，贵模型建议换便宜且通用能力还不错的模型，避免大材小用。
- 在 `utils/worldbook.test.ts` 增加测试，覆盖 Book A / Book B 替换和提示文案。

新增模块：

- 无。

影响模块：

- `apps/WorldbookApp.tsx`
- `utils/worldbook.ts`
- `utils/worldbook.test.ts`

是否修改业务逻辑：

- 是。AI 深检展示结果会把模型返回的 Book A / Book B 代称替换成真实世界书标题，降低多条候选同时查看时的混淆。

是否更新 `01_PROJECT_MAP.md`：

- 否。本次没有新增、移动或删除模块。

是否更新 `02_ARCHITECTURE.md`：

- 否。本次是世界书去重功能内部提示词和展示结果清洗。

后续注意：

- 兜底替换只处理明确的 Book A / Book B、书本A/B、世界书A/B 等代称，不改写其它 AI 建议内容。

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
