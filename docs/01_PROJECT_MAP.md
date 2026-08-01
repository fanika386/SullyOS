# SullyOS Project Map

本文件按“功能 -> 文件位置”组织。它不是完整目录树，而是给新 Task 快速定位改动范围的地图。新增功能或移动重要模块时，请同步更新本文件。

## 模块状态速览

状态只标到主要模块级别，避免给每个文件维护主观进度。这里的状态表示“当前维护阶段”，不表示代码没有 Bug。

- ✅ 已上线稳定维护：核心体验已接入桌面或基础链路，后续以维护和小迭代为主。
- 🚧 已上线持续演进：已有可用链路，但仍在频繁扩展、调优或存在多端 / 多 Worker 契约。
- 📋 资料留存或规划参考：主要是调研、历史交接、运维建议或未来规划，使用前要核对当前代码。

当前高层状态：

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目入口与手机外壳 | ✅ 已上线稳定维护 | `App.tsx`、`PhoneShell`、桌面、锁屏、懒加载和全局 overlay 已形成固定入口。 |
| 全局状态、本地数据与备份 | ✅ 已上线稳定维护 | `OSContext` + `utils/db.ts` 是主干。任何改动都属于高风险维护。 |
| AI 聊天主链路 | ✅ 已上线稳定维护 | 私聊、prompt 统一构造、工具循环和回复后处理已形成主路径。不要另起平行链路。 |
| 记忆系统 / 记忆宫殿 | 🚧 已上线持续演进 | 传统记忆和向量化记忆宫殿都已接入，但 pipeline、召回、消化和存储仍是重点维护区。 |
| Instant Push / 主动消息 / Service Worker | 🚧 已上线持续演进 | 涉及前端、Worker、SW、Web Push 和 IndexedDB 契约，改动前必须读专项文档。 |
| 角色、外观、基础桌面 App | ✅ 已上线稳定维护 | 神经链接、外观、气泡、相册、设置等已是常规功能区。 |
| 彼方、家园和内容型 App | 🚧 已上线持续演进 | 功能面广，含跨用户后端、调度、活动房间、世界演绎等多条支线。 |
| Worker / Serverless / 部署配置 | 🚧 已上线持续演进 | 多平台配置已存在，但不同能力需要用户自部署或替换代理。 |
| `notes/*` 调研与运维资料 | 📋 资料留存或规划参考 | 不是基础规范，使用前先核对当前代码和 `docs/*`。 |

## 项目入口与手机外壳

项目启动 / Provider 入口

- `App.tsx`：应用根组件，安装 dev lifecycle capture，挂载 `OSProvider`、`MusicProvider`、`PhoneShell`，并常驻 `BuildBadge`、`DevDebugPanel`、`VRBroadcast`、`WorldBroadcast`、`ChatBroadcast`。
- `index.tsx`：React DOM 挂载入口，并提前初始化 keep-alive Service Worker、主动消息恢复、彼方调度恢复、Instant Push runtime、iOS PWA workaround 和浏览器翻译崩溃护栏。
- `index.html`：Vite HTML 入口，包含部分外部库 import map / 静态资源入口。

虚拟手机外壳 / 桌面 / 应用切换

- `components/PhoneShell.tsx`：锁屏、启动动画后容器、状态栏、安全区策略、App 懒加载、App 预热、`renderApp()` 分发。
- `apps/Launcher.tsx`：桌面 / Dock / 应用入口。
- `components/os/*`：手机壳通用组件，例如状态栏、图标、弹窗、错误边界、全局播放器、小屋桌面皮肤等。
- `utils/safeAreaApps.ts`：哪些 App 自己处理安全区，哪些仍由外壳兜底。
- `utils/iosStandalone.ts`：iOS PWA / 独立模式布局判断。

App 注册

- `types.ts`：`AppID` 枚举、核心领域类型、主题和配置类型。
- `constants.tsx`：`INSTALLED_APPS`、`DOCK_APPS`、图标映射。
- `components/os/appPreload.ts`：桌面按下即预取的 App import 工厂。

## 全局状态、本地数据与备份

全局状态中心

- `context/OSContext.tsx`：全局状态、主题、API 配置、角色、群组、世界书、小说、歌曲、未读、主动消息、虚拟世界调度、备份导入导出、全局 fetch 记录、打开/关闭 App。
- `context/MusicContext.tsx`：全局音乐播放、歌词、一起听状态，以及聊天可注入的音乐快照。

本地数据库

- `utils/db.ts`：IndexedDB 主库 `AetherOS_Data`，当前 schema 版本和所有 object store / migration / CRUD。角色、消息、相册、世界书、记忆宫殿、彼方、家园、生活记录等主要持久化都在这里。
- `utils/blobRef.ts`：大图、壁纸、外观素材等 Blob 引用，避免 base64 占用 JS 堆和额外配额。
- `utils/lsMirror.ts`：把关键 localStorage 设置镜像到 IndexedDB，用于 localStorage 被清理后的恢复。
- `utils/backupFormat.ts`、`utils/backupExport.ts`、`utils/backupImportPolicy.ts`：备份包格式、资产提取和导入安全策略。
- `utils/exportGuard.ts`、`utils/shareExport.ts`：导出保护和分享导出。

## AI 聊天主链路

聊天 UI

- `apps/Chat.tsx`：私聊界面、发送消息、渲染消息列表、触发 `useChatAI`。
- `components/chat/*`：聊天界面子组件。
- `utils/messageFormat.ts`：消息卡片 / 文本 / 媒体格式化。
- `utils/streamPreview.ts`：流式预览显示。
- `utils/chatGenEvents.ts`：跨 App 的生成状态事件，供全局横幅和 Chat 刷新使用。

AI 触发与请求

- `hooks/useChatAI.ts`：私聊主调用链，负责读取最新历史、调用 `buildChatRequestPayload`、发起 LLM 请求、处理流式、工具循环、落库后处理、情绪评估和记忆宫殿后台流程。
- `utils/chatRequestPayload.ts`：聊天请求 payload 的统一构造器。正常聊天、主动消息、push 后情绪评估等路径都应复用这里，避免上下文分叉。
- `utils/chatPrompts.ts`：聊天 system prompt 三段式构造、历史消息整理、表情包、实时上下文、群聊背景、日程、音乐等注入。
- `utils/context.ts`：`ContextBuilder`，角色核心上下文来源。人设、世界书、用户档案、角色印象、长期记忆、时间意识、易变状态等从这里汇总。
- `utils/safeApi.ts`：请求 OpenAI-compatible API 的安全封装、流式解析等。
- `utils/samplingParamCompat.ts`：模型不接受采样参数时的兼容处理。
- `utils/systemMessageMerge.ts`：dev 开关下合并多条 system message 的兼容测试路径。

AI 回复后处理 / 工具 / 指令

- `utils/applyAssistantPostProcessing.ts`：回复落库后的统一副作用处理。
- `utils/chatParser.ts`：解析内联指令，例如日程、转账、戳一戳、音乐、小红书等。
- `utils/agenticTools.ts`：通用 agentic tool 调度。
- `utils/mcpClient.ts`、`utils/mcpToolBridge.ts`：用户自配 MCP 工具服务器接入。改前读 `docs/mcp-client.md` 和 `docs/mcp-user-guide.md`。
- `utils/mcdToolBridge.ts`、`utils/luckinToolBridge.ts`：点单小程序上下文和工具桥。

## 记忆系统

传统记忆 / 核心上下文

- `utils/context.ts`：`ContextBuilder.buildCoreContext()` 会统一注入角色基础设定、用户档案、印象、世界书、记忆等。
- `types.ts`：角色记忆、印象、情绪、世界书等类型。

记忆宫殿

- `apps/MemoryPalaceApp.tsx`：记忆宫殿 UI 和管理入口。
- `utils/memoryPalace/*`：向量化记忆、BM25 / hybrid search、embedding、rerank、event boxes、room plates、consolidation、digestion、export、wipe 等。
- `docs/memory-system-overview.md`：改记忆系统前必读。
- `docs/amsg-sw-idb-resilience-spec.md`：与 IndexedDB 韧性和 push 相关的历史规格。

## 角色、用户档案与外观

角色管理 / 捏人

- `apps/Character.tsx`：角色创建、导入、编辑、分组、角色设定预览。
- `apps/CharCreatorDevApp.tsx`：捏脸系统开发模式，仅开发可见。
- `utils/characterCard.ts`、`utils/characterLaunch.ts`：角色卡和启动辅助。
- `utils/creatorPartsBlob.ts`、`utils/builtinPartsPack.ts`、`utils/psdCreatorImport.ts`：捏人器素材、内置素材包、PSD 导入。
- `docs/char-creator-psd-import.md`：PSD 导入和素材包约定。
- `docs/chibi-studio.md`：Q 版形象字段和三处使用路径。

用户档案 / 生活记录

- `apps/UserApp.tsx`：用户档案、关系标签、生活记录相关入口。
- `utils/lifeRecords.ts`：生活记录、周期、药盒、锻炼等注入和数据逻辑。
- `utils/impression.ts`：角色对用户印象的归一化和默认值。

外观 / 气泡 / 桌面皮肤

- `apps/Appearance.tsx`：系统外观、桌面皮肤、聊天细节微调。
- `apps/ThemeMaker.tsx`：聊天气泡主题工坊。
- `utils/chatFineTuneCss.ts`：聊天细节 CSS 生成。
- `utils/desktopSkinBackup.ts`、`utils/wallpaperCompat.ts`：桌面皮肤 / 壁纸兼容与备份。
- `components/os/acnhIcons.tsx`、`components/os/mobilegameArt.tsx`、`components/os/gotchiScheme.ts`：特殊桌面皮肤视觉组件。

## 通信、群聊与关系系统

私聊

- `apps/Chat.tsx`
- `hooks/useChatAI.ts`
- `utils/chatRequestPayload.ts`
- `utils/chatPrompts.ts`

群聊

- `apps/GroupChat.tsx`
- `utils/groupChat/*`：群 prompt、timeline、parse、red packet、topic boxes、MCP 辅助等。
- `types.ts`：`GroupProfile` 和消息类型。

查手机 / 人际关系

- `apps/CheckPhone.tsx`
- `utils/relationshipChat.ts`
- `docs/relationship-system.md`

QQ 桥接

- `apps/QQBridge.tsx`
- `scripts/xhs-bridge.mjs`、`scripts/start-xhs.bat` 不属于 QQ 桥主链路，注意不要混淆。

## 电话、TTS、语音与见面

电话 / 语音

- `apps/CallApp.tsx`：电话 UI 和通话体验。
- `apps/VoiceDesignerApp.tsx`：MiniMax 音色设计。
- `utils/minimaxTts.ts`、`utils/fishAudioTts.ts`、`utils/ttsRouter.ts`、`utils/ttsProvider.ts`：TTS 服务商、语音提示词和路由。
- `api/minimax/*`、`api/fishaudio/tts.ts`：Vercel-style serverless 代理。
- `server/bake-voice-middleware.ts`：Vite dev server 下的本地 bake voice middleware。
- `notes/minimax-t2a-integration.md`：MiniMax T2A 接入速记。

见面 / 观测协议

- `apps/DateApp.tsx`
- `components/date/*`
- `utils/datePrompts.ts`、`utils/dateSessionRecovery.ts`、`utils/dateSprites.ts`
- `docs/date-observe.md`

## 世界、房间、社交与内容型 App

小小窝 / 像素家园 / 记忆潜行

- `apps/RoomApp.tsx`
- `apps/pixelHome/*`
- `utils/roomLaunch.ts`、`utils/roomAmbient.ts`、`utils/pixelHomeDecoration.ts`
- `utils/worldHome/*`
- `apps/WorldHomeApp.tsx`

彼方 / 虚拟世界

- `apps/VRWorldApp.tsx`
- `utils/vrWorld/*`
- `worker/post-office/*`
- `docs/signal-poetry.md`
- `docs/post-office-interactions-handoff.md`

Spark / 小红书 / 热点

- `apps/SocialApp.tsx`
- `apps/XhsStockApp.tsx`
- `apps/XhsFreeRoamApp.tsx`
- `apps/HotNewsApp.tsx`
- `utils/xhsFreeRoam.ts`、`utils/xhsMcpClient.ts`
- `utils/realtimeContext.ts`
- `worker/index.js`：主代理含热点、搜索、网页抓取、小红书 Lite、网易云音乐等能力。
- `worker/xhs-lite/*`：小红书 Lite 说明和验证。
- `notes/xhs-debug-guide.md`

音乐 / 写歌

- `apps/MusicApp.tsx`
- `apps/music/*`
- `apps/SongwritingApp.tsx`
- `utils/songPrompts.ts`、`utils/minimaxMusic.ts`、`utils/chordEngine.ts`、`utils/charMusicPersona.ts`、`utils/charMusicSchedule.ts`
- `notes/music-app.md`
- `notes/music-scaling.md`

小说 / 学习 / TRPG / 攻略本 / 都市人生

- `apps/NovelApp.tsx`、`utils/novelUtils.ts`
- `apps/StudyApp.tsx`
- `apps/GameApp.tsx`
- `apps/GuidebookApp.tsx`、`utils/guidebookPrompts.ts`、`utils/handbookGenerator.ts`、`utils/handbookOrchestrator.ts`
- `apps/LifeSimApp.tsx`、`apps/lifesim/*`、`utils/lifeSim*`

特别事件 / 全局广播

- `components/ValentineEvent.tsx`
- `components/WhiteDayEvent.tsx`
- `components/Like520Event.tsx`
- `components/UpdateNotificationEvent.tsx`
- `components/WorkerUpdateReminderEvent.tsx`
- `components/BackupReminderEvent.tsx`
- `components/VRBroadcast.tsx`
- `components/WorldBroadcast.tsx`
- `components/ChatBroadcast.tsx`

## 设置、联网与后台能力

设置 App

- `apps/Settings.tsx`：API、模型、TTS、Worker、MCP、备份、Instant Push、主动消息等设置入口。
- `utils/proxyWorker.ts`：主代理 URL 兼容和替换。
- `utils/githubClient.ts`、`utils/webdavClient.ts`：云备份相关客户端。

主动消息 / Instant Push / Service Worker

- `utils/proactiveChat.ts`
- `utils/proactivePushConfig.ts`
- `worker/proactive-push/*`
- `utils/instantPushClient.ts`
- `utils/activeMsgClient.ts`
- `utils/activeMsgRuntime.ts`
- `utils/activeMsgStore.ts`
- `utils/instantToolRunner.ts`
- `worker/instant-push/*`
- `worker/sw-keep-alive.ts`
- `public/sw-keep-alive.js`：由 `scripts/build-workers.mjs` 生成，不要手改。
- `docs/instant-push-dual-channel.md`
- `docs/instant-push-branch-notes.md`

MCP

- `utils/mcpClient.ts`
- `utils/mcpToolBridge.ts`
- `scripts/mcp-proxy.mjs`
- `worker/mcp-proxy/*`
- `docs/mcp-client.md`
- `docs/mcp-user-guide.md`

## 后端、Worker 与部署配置

前端构建

- `package.json`：脚本、依赖、`pnpm run build`。
- `vite.config.ts`：React 插件、dev proxy、build badge 编译时常量、GitHub Pages base、Rollup chunk 策略、外部依赖。
- `scripts/build-workers.mjs`：构建 Worker bundle 和 public service worker 产物。
- `vitest.config.ts`、`test-setup.ts`：测试配置。

静态站部署

- `.github/workflows/deploy-pages.yml`：GitHub Pages workflow，push 到 `main` / `master` 或手动触发，Node 20 + pnpm 10 + `pnpm run build`，发布 `dist/`。
- `vercel.json`：Vercel 静态构建，`buildCommand` 为 `vite build`，输出 `dist`，SPA fallback rewrite 到 `index.html`。
- `netlify.toml`：Netlify 发布 `dist`，函数目录 `netlify/functions`，多条 `/api/v1/*` redirect 到 Netlify Functions。

Serverless / Worker

- `worker/index.js`：主 Cloudflare Worker 代理，覆盖联网搜索、WebDAV / GitHub 云备份、Notion、飞书、小红书 Lite、网页抓取、Fish Audio TTS、音乐生成、网易云音乐等。
- `cloudflare/github-handler.ts`、`cloudflare/webdav-handler.ts`：Cloudflare Worker 路由处理器。
- `worker/instant-push/*`：Instant Push 独立 Worker。
- `worker/proactive-push/*`：主动消息 Push 加速器。
- `worker/post-office/*`：彼方邮局 / 信号坠落处共享后端。
- `worker/loyal-recruitment/*`：忠实用户一次性招募 Worker。
- `worker/mcp-proxy/*`：用户自部署 MCP CORS 代理。
- `netlify/functions/*`：Netlify 版本的主动消息 / 租户 / 通知函数。
- `api/minimax/*`、`api/fishaudio/tts.ts`：Vercel-style API route。

移动端

- `capacitor.config.json`
- `android/`：Capacitor Android 工程。
- `open-local-web.bat`、`build-and-open-local-web.bat`：Windows 本地辅助脚本。

## 文档与维护资料

基础文档

- `docs/00_READ_FIRST.md`
- `docs/01_PROJECT_MAP.md`
- `docs/02_ARCHITECTURE.md`
- `docs/03_DEVELOPMENT_RULES.md`
- `docs/04_CHANGELOG.md`

导航与专项文档

- `CLAUDE.md`：按问题类型跳转到专项文档。
- `README.md`：产品介绍、运行方式、二改注意、部署注意和许可说明。
- `docs/*.md`：长期专项文档。
- `notes/*.md`：调研、运维和集成笔记，稳定性不一定等同于 `docs/`，使用前核对当前代码。
