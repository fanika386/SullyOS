# SullyOS Architecture

本文说明 SullyOS 为什么这样组织，以及新任务改动时应该尊重哪些边界。

## 总体设计

SullyOS 是一个 local-first 的浏览器虚拟手机系统。前端承载主要产品体验和大部分业务状态，用户数据默认保存在本机 IndexedDB；联网能力、推送、备份代理、TTS 代理、音乐、小红书 Lite、MCP CORS 代理等通过可选 Worker 或 Serverless 服务补齐。

这意味着项目不是传统“前端 + 自家中心后端数据库”的架构。正式静态站只发布 `dist/`，用户的聊天记录、角色、世界书、相册、主题、记忆等主要数据仍在浏览器本地。Cloudflare Worker / Netlify Functions / Vercel API routes 多数是代理、签名、推送或跨域桥，不是统一业务后端。

## 分层结构

应用根层

- `App.tsx` 挂载全局 provider 和常驻 overlay。
- `OSProvider` 提供系统状态、数据加载、备份、通知、主动消息和 App 导航。
- `MusicProvider` 提供全局音乐播放状态，聊天和世界模块会读取它作为上下文。
- `PhoneShell` 负责锁屏、启动动画、App 容器、安全区、懒加载和错误边界。

App 注册层

- `types.ts` 的 `AppID` 是所有 App 的稳定 ID。
- `constants.tsx` 的 `INSTALLED_APPS` 决定桌面显示的 App、图标和颜色。
- `components/PhoneShell.tsx` 的 `renderApp()` 决定 `AppID -> React Component`。
- 新增 App 时这三处通常必须一起更新，必要时还要更新 `components/os/appPreload.ts`。

状态和数据层

- `context/OSContext.tsx` 是全局状态编排中心，负责从 DB / localStorage 加载数据，并向 App 暴露统一操作。
- `utils/db.ts` 是 IndexedDB 主库 `AetherOS_Data` 的 schema 和数据访问层。当前项目的角色、消息、主题、资产、相册、群聊、世界书、记忆宫殿、彼方、家园、生活记录等都在这里或其配套 store 中持久化。
- `localStorage` 主要保存设置、开关和小型运行配置，关键配置通过 `utils/lsMirror.ts` 镜像回 IndexedDB。
- 大图和素材通过 `utils/blobRef.ts` 进入 Blob 存储，避免把 base64 长期留在 JS 堆或 JSON 备份里。

功能 App 层

- `apps/*.tsx` 是用户可见 App 的主要 UI 和功能编排。
- 复杂 App 会拆到同目录子文件夹，例如 `apps/pixelHome/*`、`apps/lifesim/*`、`apps/music/*`。
- 可复用业务逻辑、prompt、解析器、客户端、存储工具应放在 `utils/*`，避免多个 App 复制实现。

后台 / 外部服务层

- `worker/index.js` 是主 Cloudflare Worker 代理。
- `worker/instant-push/*`、`worker/proactive-push/*`、`worker/post-office/*`、`worker/loyal-recruitment/*`、`worker/mcp-proxy/*` 是独立 Worker。
- `netlify/functions/*` 提供 Netlify 版本的主动消息 / 通知 / 租户接口。
- `api/minimax/*` 和 `api/fishaudio/tts.ts` 是 Vercel-style serverless route。

## AI 请求链路

私聊主链路按以下顺序运行：

1. 用户在 `apps/Chat.tsx` 发送消息。
2. 消息写入 `utils/db.ts` 的 messages store，并刷新 UI 状态。
3. `hooks/useChatAI.ts` 的 `triggerAI()` 从 DB 重新读取最近历史，避免 React state 时序漏掉刚写入的消息。
4. `utils/chatRequestPayload.ts` 的 `buildChatRequestPayload()` 统一构造请求材料。
5. 构造器先调用 Memory Palace 注入，然后调用 `utils/chatPrompts.ts` 的三段式 prompt 构造。
6. `utils/context.ts` 的 `ContextBuilder` 负责角色核心上下文：人设、世界书、用户档案、角色印象、长期记忆、时间意识和易变状态。
7. `buildChatRequestPayload()` 继续追加双语、HTML、思考链、点单小程序、MCP 等模式块，并输出 `fullMessages`。
8. `useChatAI.ts` 使用 OpenAI-compatible `/chat/completions` 调用模型，支持流式预览和工具循环。
9. 回复交给 `utils/applyAssistantPostProcessing.ts` 和 `utils/chatParser.ts` 执行副作用，例如日程、转账、音乐、小红书、卡片等。
10. 最终消息落库，随后触发记忆宫殿后台处理、情绪评估、生成状态事件和 UI 刷新。

设计重点：正常聊天、主动消息和 push 后情绪评估都应尽量复用 `buildChatRequestPayload()`。不要在新功能里另起一套 prompt 拼装，否则长期记忆、音乐、MCP、HTML、双语、日程、情绪等上下文会分叉。

## Prompt 与上下文设计

核心 prompt 被拆成稳定段、易变段和 recency tail：

- 稳定段：人设、世界书、印象、行为规范、语音指南等变化较慢的信息，放在首条 system message，便于中转前缀缓存。
- 易变段：当前时间、记忆召回、情绪 buff、实时天气 / 新闻、日程、音乐、群聊背景、点单快照等每轮变化的信息，放在历史消息之后，更靠近生成点。
- recency tail：总纲和“回到你自己”类钢印，必须保持在模型开口前最后读到的位置。

涉及 prompt 的改动优先放在：

- `utils/context.ts`
- `utils/chatPrompts.ts`
- `utils/chatRequestPayload.ts`
- 对应领域 prompt 文件，例如 `utils/datePrompts.ts`、`utils/groupChat/prompts.ts`、`utils/songPrompts.ts`、`utils/lifeSimPrompts.ts`、`utils/vrWorld/prompts.ts`

## 数据流

普通用户操作的数据流：

```text
用户操作
  -> App 组件
  -> OSContext 暴露的方法或领域 utils
  -> IndexedDB / localStorage
  -> OSContext state 刷新
  -> App 重新读取并渲染
```

聊天生成的数据流：

```text
用户消息
  -> DB.saveMessage
  -> useChatAI.triggerAI
  -> DB.getRecentMessagesByCharId
  -> buildChatRequestPayload
  -> safe API / fetch
  -> stream preview
  -> applyAssistantPostProcessing
  -> DB.saveMessage
  -> memory / emotion / UI events
```

Instant Push 的大致数据流：

```text
前端配置 Instant Push
  -> worker/instant-push 负责 LLM / push 决策
  -> Web Push / Service Worker 收到内容
  -> activeMsgRuntime 写入本地 DB
  -> useChatAI 或 mount drain 兜底跑后续情绪 / 状态刷新
```

## UI 与业务逻辑分离

这个项目不是严格的“纯 UI 组件 + service 层”结构。历史上不少 App `.tsx` 同时包含 UI、状态编排和少量领域逻辑。新改动应遵循现有风格，但在以下场景优先拆到 `utils/`：

- 多个 App 共享的逻辑。
- Prompt / parser / payload / API client。
- 数据迁移、备份、格式化和兼容层。
- 需要单测覆盖的纯函数。

App 内可以保留只服务本 App 的交互状态和轻量编排。跨模块副作用不要藏在 UI 组件深处。

## 运行与部署

本地开发

- 推荐命令：`pnpm install`、`pnpm dev`。
- Vite 默认开发地址：`http://localhost:5173`。
- `vite.config.ts` 配置了 MiniMax / Fish Audio 等 dev proxy，以及 `server/bake-voice-middleware.ts`。

正式前端构建

- 推荐命令：`pnpm run build`。
- `package.json` 中 `build` 实际会执行 `pnpm run build:workers && vite build`。
- `scripts/build-workers.mjs` 会打包 Instant Push、Deno 入口、`sw-keep-alive`、post-office、loyal-recruitment 等配置中的 Worker，并更新 `public/instant-worker.version.txt`。
- Vite 输出目录是 `dist/`。

是否是标准 Vite 项目

- 是标准 React + TypeScript + Vite SPA 项目：`vite.config.ts`、`@vitejs/plugin-react`、`vite build`、`vite preview` 都是常规 Vite 流程。
- 但它不是只有前端源码的简单 SPA：构建前会生成 Worker / Service Worker 产物，部署配置也同时覆盖多平台。

已有部署配置

- GitHub Pages：`.github/workflows/deploy-pages.yml`，push 到 `main` / `master` 或手动触发，Node 20 + pnpm 10，发布 `dist/`。
- Vercel：`vercel.json`，build command 是 `vite build`，输出 `dist`，并把非 API / 非静态资源路径 rewrite 到 `index.html`。
- Netlify：`netlify.toml`，发布 `dist`，函数目录是 `netlify/functions`，`/api/v1/*` redirect 到对应 Netlify Functions。
- Cloudflare Workers：`worker/*/wrangler.toml` 和 `worker/index.js`，用于可选代理、push、邮局、MCP CORS 等，不等同于前端静态站本体。
- Capacitor：`capacitor.config.json` 和 `android/` 支持 Android 打包。

正式部署预期

- 前端正式部署预期是静态托管 `dist/`，可用 GitHub Pages、Vercel、Netlify、Cloudflare Pages 或其他静态托管。
- 如果要启用联网代理、推送、MCP CORS、邮局或招募等能力，需要按对应 Worker / Function 文档部署或配置外部服务。
- README 明确提醒二改用户应替换自己的 Worker，避免把流量打到作者公共实例。

## 不建议随意修改的地方

- `utils/db.ts` 的 DB name、version、store 和 migration。任何改动都可能影响用户本机数据。
- `context/OSContext.tsx` 的启动加载、备份导入导出、全局 fetch 拦截和主动消息 / 世界调度。
- `utils/context.ts`、`utils/chatPrompts.ts`、`utils/chatRequestPayload.ts` 的 prompt 主链路。
- `hooks/useChatAI.ts` 的工具循环、流式、落库、情绪评估和记忆宫殿尾段。
- `worker/sw-keep-alive.ts`、`utils/activeMsgRuntime.ts`、`utils/instantPushClient.ts`、`worker/instant-push/*` 的 Instant Push 契约。
- `public/*worker*.bundle.js`、`worker/*/worker.bundle.js` 等生成文件。它们应由 `scripts/build-workers.mjs` 产生。
- 备份格式和导入策略。涉及用户数据迁移时必须写针对性测试。

## 适合扩展的地方

- 新 App：`apps/`、`types.ts`、`constants.tsx`、`components/PhoneShell.tsx`、`components/os/appPreload.ts`。
- 新领域工具：优先放到 `utils/<domain>.ts` 或 `utils/<domain>/*`，由 App 调用。
- 新 prompt：放在对应领域 prompt 文件；如果影响聊天主链路，接入 `buildChatRequestPayload()`。
- 新 Worker：优先新建 `worker/<name>/src/index.ts` 和 `wrangler.toml`，需要随前端发布的 bundle 再加入 `scripts/build-workers.mjs`。
- 新专项文档：放到 `docs/`，并在 `CLAUDE.md` 或 `docs/01_PROJECT_MAP.md` 加入口。
