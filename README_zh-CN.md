# OpenClaw Zero Token

**免 API Token 使用大模型** - 通过浏览器登录方式免费使用 DeepSeek、豆包、Claude、ChatGPT 等 AI 模型。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | 简体中文

---

## 项目简介

OpenClaw Zero Token 是 [OpenClaw](https://github.com/openclaw/openclaw) 的分支版本，核心目标是**免除 API Token 费用**，通过模拟浏览器登录捕获会话凭证，实现对各大 AI 平台的免费访问。

### 为什么选择 Zero Token？

| 传统方式 | Zero Token 方式 |
|---------|----------------|
| 需要购买 API Token | **完全免费** |
| 按调用次数计费 | 无使用限制 |
| 需要绑定信用卡 | 仅需网页登录 |
| Token 可能泄露 | 凭证本地存储 |

### 支持的平台

| 平台 | 状态 | 模型 |
|-----|------|------|
| DeepSeek | ✅ **当前支持** | deepseek-chat, deepseek-reasoner |
| 豆包 (Doubao) | ✅ **当前支持** | doubao（via doubao-free-api） |
| Claude Web | 🔜 计划中 | - |
| ChatGPT Web | 🔜 计划中 | - |

> **注意：** 豆包需配合 [doubao-free-api](https://github.com/linuxhsj/doubao-free-api) 代理使用，详见下文「豆包实现原理与部署」。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OpenClaw Zero Token                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Web UI    │    │  CLI/TUI    │    │   Gateway   │    │  Channels   │  │
│  │  (Lit 3.x)  │    │             │    │  (Port API) │    │ (Telegram…) │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┴──────────────────┴──────────────────┘          │
│                                    │                                         │
│                           ┌────────▼────────┐                               │
│                           │   Agent Core    │                               │
│                           │  (PI-AI Engine) │                               │
│                           └────────┬────────┘                               │
│                                    │                                         │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐  │
│  │                          Provider Layer                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ DeepSeek Web │  │ Doubao Proxy │  │   OpenAI     │  │ Anthropic   │  │  │
│  │  │ (Zero Token) │  │ (Zero Token) │  │   (Token)    │  │  (Token)    │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 免 Token 实现原理

### 核心流程

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        DeepSeek Web 认证流程                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 启动浏览器                                                              │
│     ┌─────────────┐                                                        │
│     │ openclaw    │ ──启动──▶ Chrome (CDP Port: 18892)                     │
│     │ gateway     │           带用户数据目录                                │
│     └─────────────┘                                                        │
│                                                                             │
│  2. 用户登录                                                                │
│     ┌─────────────┐                                                        │
│     │ 用户在浏览器 │ ──访问──▶ https://chat.deepseek.com                    │
│     │ 中手动登录  │           扫码/账号密码登录                             │
│     └─────────────┘                                                        │
│                                                                             │
│  3. 捕获凭证                                                                │
│     ┌─────────────┐                                                        │
│     │ Playwright  │ ──监听──▶ 网络请求                                     │
│     │ CDP 连接    │           拦截 Authorization Header                    │
│     └─────────────┘           获取 Cookie                                   │
│                                                                             │
│  4. 存储凭证                                                                │
│     ┌─────────────┐                                                        │
│     │ auth.json   │ ◀──保存── { cookie, bearer, userAgent }               │
│     └─────────────┘                                                        │
│                                                                             │
│  5. API 调用                                                                │
│     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│     │ DeepSeek    │ ──▶ │ DeepSeek    │ ──▶ │ chat.deep-  │               │
│     │ WebClient   │     │ Web API     │     │ seek.com    │               │
│     └─────────────┘     └─────────────┘     └─────────────┘               │
│         使用存储的 Cookie + Bearer Token                                    │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 关键技术点

| 技术点 | 实现方式 |
|-------|---------|
| **浏览器自动化** | Playwright CDP 连接 Chrome |
| **凭证捕获** | 监听网络请求，提取 Authorization Header |
| **PoW 挑战** | WASM SHA3 计算反爬答案 |
| **流式响应** | SSE 解析 + 自定义标签解析器 |

---

## 豆包实现原理与部署

### 一、总体原理

豆包集成基于**网页端 Cookie 认证**，不依赖官方 API Key：

```
浏览器登录豆包 → 获取 sessionid（F12 → Application → Cookies）→
  doubao-proxy：将 sessionid 传给本地代理，代理内部用 Cookie 调用豆包 API
  doubao-web：直接用 Cookie 冒充网页请求调用豆包内部 API（备选，SSE 格式易变）
```

**推荐使用 doubao-proxy**：通过 [doubao-free-api](https://github.com/linuxhsj/doubao-free-api) 本地代理，对外提供 OpenAI 兼容接口，更稳定、易调试。

### 二、两种方案对比

| 方案 | 推荐度 | API 端点 | 认证方式 | 请求/响应格式 |
|------|--------|----------|----------|---------------|
| **doubao-proxy** | ★ 推荐 | 本地 `http://127.0.0.1:8000/v1/chat/completions` | Bearer Token（sessionid） | 标准 OpenAI 格式 |
| **doubao-web** | 备选 | `https://www.doubao.com/...` 直连 | Cookie（sessionid、ttwid 等） | 豆包自定义 SSE |

### 三、技术架构与代码结构

```
src/
├── providers/
│   ├── doubao-web-auth.ts      # 豆包浏览器登录与凭证捕获
│   └── doubao-web-client.ts    # 豆包网页 API 客户端（doubao-web 用）
├── agents/
│   ├── doubao-web-stream.ts    # doubao-web 流式响应解析
│   └── models-config.providers.ts  # doubao-proxy 注册（api: openai-completions）
└── commands/
    ├── auth-choice.apply.doubao-proxy.ts   # doubao-proxy 配置流程
    ├── auth-choice.apply.doubao-web.ts     # doubao-web 配置流程
    └── onboard-auth.config-core.ts         # applyDoubaoProxyConfig 等
```

**doubao-proxy 数据流**（无需自定义 stream，复用 OpenAI 兼容路径）：

```
Web UI → chat.send → runEmbeddedAttempt → authStorage.getApiKey("doubao-proxy")
  → streamSimple（PI-AI）→ fetch(baseUrl/chat/completions, Authorization: Bearer sessionid)
  → doubao-free-api 代理转发到豆包 → 标准 SSE 流 → Web UI
```

**doubao-web 数据流**（需自定义 stream 解析豆包 SSE）：

```
Web UI → createDoubaoWebStreamFn(cookie) → DoubaoWebClient.chatCompletions(stream: true)
  → fetch 豆包内部 API → 解析 event_type 2001/2003 等 → text_delta → Web UI
```

### 四、doubao-free-api 部署

推荐使用 [linuxhsj/doubao-free-api](https://github.com/linuxhsj/doubao-free-api)，支持文生图、图生图、图文解读等。

#### 4.1 获取 sessionid

1. 打开 [https://www.doubao.com](https://www.doubao.com) 并登录
2. 按 F12 打开开发者工具 → Application → Cookies
3. 复制 `sessionid` 的值

#### 4.2 原生部署（推荐）

```bash
git clone https://github.com/linuxhsj/doubao-free-api.git
cd doubao-free-api
npm i
npm run build
npm start   # 或 pm2 start dist/index.js --name doubao-free-api
```

#### 4.3 Docker 部署

```bash
docker run -it -d --init --name doubao-free-api -p 8000:8000 \
  -e TZ=Asia/Shanghai linuxhsj/doubao-free-api:latest

docker logs -f doubao-free-api
```

#### 4.4 Docker Compose 部署

```yaml
version: '3'
services:
  doubao-free-api:
    container_name: doubao-free-api
    image: linuxhsj/doubao-free-api:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      - TZ=Asia/Shanghai
```

#### 4.5 OpenClaw 配置

1. 运行 `node openclaw.mjs onboard`，选择 **豆包 (Doubao)** → **doubao-proxy**
2. baseUrl 默认 `http://127.0.0.1:8000/v1`（若代理在其他主机，改为对应地址）
3. 粘贴 sessionid，完成配置

#### 4.6 验证

```bash
curl -N -X POST "http://127.0.0.1:8000/v1/chat/completions" \
  -H "Authorization: Bearer <sessionid>" \
  -H "Content-Type: application/json" \
  -d '{"model":"doubao","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

若返回 SSE 流，说明代理正常。

### 五、认证与配置存储

| 存储位置 | 说明 |
|----------|------|
| `auth-profiles.json` | `doubao-proxy:default` 的 `key` 即为 sessionid |
| `openclaw.json` | `models.providers["doubao-proxy"].baseUrl`、`agents.defaults.model.primary` |
| 环境变量 | 可选 `DOUBAO_PROXY_SESSIONID` |

### 六、注意事项

- **sessionid 存活**：豆包会定期失效，需重新登录并更新 sessionid
- **多账号**：doubao-free-api 支持 `Authorization: Bearer sessionid1,sessionid2` 多路 token
- **端口**：默认 8000，确保防火墙或云安全组放行
- **合规**：逆向 API 仅供自用学习，商用请使用 [火山引擎官方 API](https://www.volcengine.com/product/doubao)

---

## 快速开始

### 环境要求

- Node.js >= 22.12.0
- pnpm >= 9.0.0
- Chrome 浏览器

### 安装

```bash
# 克隆仓库
git clone https://github.com/linuxhsj/openclaw-zero-token.git
cd openclaw-zero-token

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 配置 DeepSeek Web 认证

```bash
# 运行配置向导
node openclaw.mjs onboard

# 选择认证方式
? Auth provider: DeepSeek (Browser Login)

# 选择登录模式
? DeepSeek Auth Mode: 
  > Automated Login (Recommended)  # 自动捕获凭证
    Manual Paste                   # 手动粘贴凭证
```

### 使用已有 Chrome（可选）

若希望用本机已安装的 Chrome、保留现有登录状态，可先以远程调试模式启动 Chrome，再在 onboard 向导中选择「使用已有 Chrome」：

**macOS：**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

然后在另一个终端运行 `node openclaw.mjs onboard`，选择对应认证方式并选「Use Existing Chrome」即可。端口 `9222` 为项目默认 CDP 端口。

### 启动 Gateway

```bash
# 启动服务
node openclaw.mjs gateway

# 访问 Web UI
open http://127.0.0.1:3001
```

---

## 使用方式

### Web UI

访问 `http://127.0.0.1:3001`，在聊天界面直接使用 DeepSeek 模型。

### API 调用

```bash
# 使用 Gateway Token 调用
curl http://127.0.0.1:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-web/deepseek-chat",
    "messages": [{"role": "user", "content": "你好！"}]
  }'
```

### CLI 模式

```bash
# 交互式命令行
node openclaw.mjs tui
```

---

## 配置说明

### openclaw.json

```json
{
  "auth": {
    "profiles": {
      "deepseek-web:default": {
        "provider": "deepseek-web",
        "mode": "api_key"
      }
    }
  },
  "models": {
    "providers": {
      "deepseek-web": {
        "baseUrl": "https://chat.deepseek.com",
        "api": "deepseek-web",
        "models": [
          {
            "id": "deepseek-chat",
            "name": "DeepSeek Chat",
            "contextWindow": 64000,
            "maxTokens": 4096
          },
          {
            "id": "deepseek-reasoner",
            "name": "DeepSeek Reasoner",
            "reasoning": true,
            "contextWindow": 64000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "gateway": {
    "port": 3001,
    "auth": {
      "mode": "token",
      "token": "your-gateway-token"
    }
  }
}
```

---

## 开发路线

### 当前重点
- ✅ DeepSeek Web 认证（稳定）
- ✅ 豆包 via doubao-free-api
- 🔧 提高凭证捕获可靠性
- 📝 文档改进

### 计划功能
- 🔜 Claude Web 认证支持
- 🔜 ChatGPT Web 认证支持
- 🔜 过期会话自动刷新

---

## 扩展其他平台

要添加新的 Web 认证平台，需要创建以下文件：

### 1. 认证模块 (`src/providers/{platform}-web-auth.ts`)

```typescript
export async function loginPlatformWeb(params: {
  onProgress: (msg: string) => void;
  openUrl: (url: string) => Promise<boolean>;
}): Promise<{ cookie: string; bearer: string; userAgent: string }> {
  // 浏览器自动化登录，捕获凭证
}
```

### 2. API 客户端 (`src/providers/{platform}-web-client.ts`)

```typescript
export class PlatformWebClient {
  constructor(options: { cookie: string; bearer?: string }) {}
  
  async chatCompletions(params: ChatParams): Promise<ReadableStream> {
    // 调用平台 Web API
  }
}
```

### 3. 流处理器 (`src/agents/{platform}-web-stream.ts`)

```typescript
export function createPlatformWebStreamFn(credentials: string): StreamFn {
  // 处理平台特有的响应格式
}
```

---

## 文件结构

```
openclaw-zero-token/
├── src/
│   ├── providers/
│   │   ├── deepseek-web-auth.ts      # DeepSeek 登录捕获
│   │   └── deepseek-web-client.ts    # DeepSeek API 客户端
│   ├── agents/
│   │   └── deepseek-web-stream.ts    # 流式响应处理
│   ├── commands/
│   │   └── auth-choice.apply.deepseek-web.ts  # 认证流程
│   └── browser/
│       └── chrome.ts                 # Chrome 自动化
├── ui/                               # Web UI (Lit 3.x)
├── .openclaw-state/                  # 本地状态 (不提交)
│   ├── openclaw.json                 # 配置
│   └── agents/main/agent/
│       └── auth.json                 # 凭证 (敏感)
└── .gitignore                        # 包含 .openclaw-state/
```

---

## 安全注意事项

1. **凭证存储**: Cookie 和 Bearer Token 存储在本地 `auth.json`，**绝不提交到 Git**
2. **会话有效期**: Web 会话可能过期，需要定期重新登录
3. **使用限制**: Web API 可能有速率限制，不适合高频调用
4. **合规使用**: 仅用于个人学习研究，请遵守平台服务条款

---

## 与上游同步

本项目基于 OpenClaw，可以通过以下方式同步上游更新：

```bash
# 添加上游仓库
git remote add upstream https://github.com/openclaw/openclaw.git

# 同步上游更新
git fetch upstream
git merge upstream/main
```

---

## 贡献指南

欢迎贡献代码，特别是：
- 新平台的 Web 认证支持（豆包、Claude、ChatGPT 等）
- Bug 修复
- 文档改进

---

## 许可证

[MIT License](LICENSE)

---

## 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) - 原始项目
- [DeepSeek](https://deepseek.com) - 优秀的 AI 模型

---

## 免责声明

本项目仅供学习和研究使用。使用本项目访问任何第三方服务时，请确保遵守该服务的使用条款。开发者不对因使用本项目而产生的任何问题负责。
