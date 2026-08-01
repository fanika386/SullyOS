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
