# OpenClaw Zero Token

**Use AI Models Without API Tokens** - Access DeepSeek, Doubao, Claude, ChatGPT and more for free via browser login authentication.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [简体中文](README_zh-CN.md)

---

## Overview

OpenClaw Zero Token is a fork of [OpenClaw](https://github.com/openclaw/openclaw) with a core mission: **eliminate API token costs** by capturing session credentials through browser automation, enabling free access to major AI platforms.

### Why Zero Token?

| Traditional Approach | Zero Token Approach |
|---------------------|---------------------|
| Requires purchasing API tokens | **Completely free** |
| Pay per API call | No usage limits |
| Credit card binding required | Only web login needed |
| Potential token leakage | Credentials stored locally |

### Supported Platforms

| Platform | Status | Models |
|----------|--------|--------|
| DeepSeek | ✅ **Currently Supported** | deepseek-chat, deepseek-reasoner |
| Doubao (豆包) | ✅ **Currently Supported** | doubao (via doubao-free-api) |
| Claude Web | 🔜 Coming Soon | - |
| ChatGPT Web | 🔜 Coming Soon | - |

> **Note:** Doubao requires [doubao-free-api](https://github.com/linuxhsj/doubao-free-api) proxy. See "Doubao Implementation & Deployment" below for details.

---

## System Architecture

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

## How It Works

### Zero Token Authentication Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     DeepSeek Web Authentication Flow                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Launch Browser                                                          │
│     ┌─────────────┐                                                        │
│     │ openclaw    │ ──start──▶ Chrome (CDP Port: 18892)                    │
│     │ gateway     │             with user data directory                   │
│     └─────────────┘                                                        │
│                                                                             │
│  2. User Login                                                              │
│     ┌─────────────┐                                                        │
│     │ User logs in│ ──visit──▶ https://chat.deepseek.com                   │
│     │  browser    │             scan QR / password login                    │
│     └─────────────┘                                                        │
│                                                                             │
│  3. Capture Credentials                                                     │
│     ┌─────────────┐                                                        │
│     │ Playwright  │ ──listen──▶ Network requests                           │
│     │ CDP Connect │              Intercept Authorization Header            │
│     └─────────────┘              Extract Cookies                            │
│                                                                             │
│  4. Store Credentials                                                       │
│     ┌─────────────┐                                                        │
│     │ auth.json   │ ◀──save── { cookie, bearer, userAgent }               │
│     └─────────────┘                                                        │
│                                                                             │
│  5. API Calls                                                               │
│     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│     │ DeepSeek    │ ──▶ │ DeepSeek    │ ──▶ │ chat.deep-  │               │
│     │ WebClient   │     │ Web API     │     │ seek.com    │               │
│     └─────────────┘     └─────────────┘     └─────────────┘               │
│         Using stored Cookie + Bearer Token                                  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Technical Components

| Component | Implementation |
|-----------|----------------|
| **Browser Automation** | Playwright CDP connection to Chrome |
| **Credential Capture** | Network request interception, Authorization Header extraction |
| **PoW Challenge** | WASM SHA3 computation for anti-bot bypass |
| **Streaming Response** | SSE parsing + custom tag parser |

---

## Doubao Implementation & Deployment

### Overview

Doubao integration uses **web Cookie authentication** (no official API key required):

```
Browser login → Get sessionid (F12 → Application → Cookies) →
  doubao-proxy: Pass sessionid to local proxy, proxy calls Doubao API internally
  doubao-web: Direct Cookie-based requests to Doubao internal API (fallback, SSE format may change)
```

**Recommended: doubao-proxy** — Use [doubao-free-api](https://github.com/linuxhsj/doubao-free-api) for an OpenAI-compatible interface; more stable and easier to debug.

### Two Approaches Compared

| Approach | Recommended | API Endpoint | Auth | Request/Response |
|----------|-------------|--------------|------|-------------------|
| **doubao-proxy** | ★ Yes | Local `http://127.0.0.1:8000/v1/chat/completions` | Bearer Token (sessionid) | Standard OpenAI format |
| **doubao-web** | Fallback | `https://www.doubao.com/...` direct | Cookie (sessionid, ttwid, etc.) | Doubao custom SSE |

### Code Structure

```
src/
├── providers/
│   ├── doubao-web-auth.ts      # Browser login & credential capture
│   └── doubao-web-client.ts    # Doubao web API client (for doubao-web)
├── agents/
│   ├── doubao-web-stream.ts    # doubao-web streaming response parser
│   └── models-config.providers.ts  # doubao-proxy registration (api: openai-completions)
└── commands/
    ├── auth-choice.apply.doubao-proxy.ts   # doubao-proxy setup flow
    ├── auth-choice.apply.doubao-web.ts     # doubao-web setup flow
    └── onboard-auth.config-core.ts         # applyDoubaoProxyConfig etc.
```

### doubao-free-api Deployment

Use [linuxhsj/doubao-free-api](https://github.com/linuxhsj/doubao-free-api). Supports text-to-image, image-to-image, image understanding, etc.

#### Get sessionid

1. Open [https://www.doubao.com](https://www.doubao.com) and log in
2. Press F12 → Application → Cookies
3. Copy the `sessionid` value

#### Native Deployment (Recommended)

```bash
git clone https://github.com/linuxhsj/doubao-free-api.git
cd doubao-free-api
npm i
npm run build
npm start   # or: pm2 start dist/index.js --name doubao-free-api
```

#### Docker Deployment

```bash
docker run -it -d --init --name doubao-free-api -p 8000:8000 \
  -e TZ=Asia/Shanghai linuxhsj/doubao-free-api:latest

docker logs -f doubao-free-api
```

#### Docker Compose

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

#### OpenClaw Configuration

1. Run `node openclaw.mjs onboard`, select **Doubao** → **doubao-proxy**
2. Default baseUrl: `http://127.0.0.1:8000/v1` (change if proxy runs elsewhere)
3. Paste sessionid to finish setup

#### Verification

```bash
curl -N -X POST "http://127.0.0.1:8000/v1/chat/completions" \
  -H "Authorization: Bearer <sessionid>" \
  -H "Content-Type: application/json" \
  -d '{"model":"doubao","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

If SSE stream is returned, the proxy is working.

### Auth & Config Storage

| Location | Description |
|----------|-------------|
| `auth-profiles.json` | `doubao-proxy:default` → `key` is sessionid |
| `openclaw.json` | `models.providers["doubao-proxy"].baseUrl`, `agents.defaults.model.primary` |
| Env var | Optional `DOUBAO_PROXY_SESSIONID` |

### Notes

- **sessionid expiry**: Doubao sessions expire; re-login and update sessionid when needed
- **Multi-account**: doubao-free-api supports `Authorization: Bearer sessionid1,sessionid2`
- **Port**: Default 8000; ensure firewall/security group allows it
- **Compliance**: Reverse API for personal use only; use [Volcengine official API](https://www.volcengine.com/product/doubao) for commercial use

---

## Quick Start

### Requirements

- Node.js >= 22.12.0
- pnpm >= 9.0.0
- Chrome Browser

### Installation

```bash
# Clone the repository
git clone https://github.com/linuxhsj/openclaw-zero-token.git
cd openclaw-zero-token

# Install dependencies
pnpm install

# Build
pnpm build
```

### Configure DeepSeek Web Authentication

```bash
# Run setup wizard
node openclaw.mjs onboard

# Select authentication method
? Auth provider: DeepSeek (Browser Login)

# Choose login mode
? DeepSeek Auth Mode: 
  > Automated Login (Recommended)  # Auto-capture credentials
    Manual Paste                   # Manually paste credentials
```

### Start Gateway

```bash
# Start the service
node openclaw.mjs gateway

# Access Web UI
open http://127.0.0.1:3001
```

---

## Usage

### Web UI

Visit `http://127.0.0.1:3001` and start chatting with DeepSeek models directly.

### API Calls

```bash
# Call via Gateway Token
curl http://127.0.0.1:3001/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-web/deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### CLI Mode

```bash
# Interactive terminal
node openclaw.mjs tui
```

---

## Configuration

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

## Roadmap

### Current Focus
- ✅ DeepSeek Web authentication (stable)
- ✅ Doubao via doubao-free-api
- 🔧 Improving credential capture reliability
- 📝 Documentation improvements

### Planned Features
- 🔜 Claude Web authentication support
- 🔜 ChatGPT Web authentication support
- 🔜 Auto-refresh for expired sessions

---

## Adding New Platforms

To add support for a new platform, create the following files:

### 1. Authentication Module (`src/providers/{platform}-web-auth.ts`)

```typescript
export async function loginPlatformWeb(params: {
  onProgress: (msg: string) => void;
  openUrl: (url: string) => Promise<boolean>;
}): Promise<{ cookie: string; bearer: string; userAgent: string }> {
  // Browser automation login, capture credentials
}
```

### 2. API Client (`src/providers/{platform}-web-client.ts`)

```typescript
export class PlatformWebClient {
  constructor(options: { cookie: string; bearer?: string }) {}
  
  async chatCompletions(params: ChatParams): Promise<ReadableStream> {
    // Call platform Web API
  }
}
```

### 3. Stream Handler (`src/agents/{platform}-web-stream.ts`)

```typescript
export function createPlatformWebStreamFn(credentials: string): StreamFn {
  // Handle platform-specific response format
}
```

---

## Project Structure

```
openclaw-zero-token/
├── src/
│   ├── providers/
│   │   ├── deepseek-web-auth.ts      # DeepSeek login capture
│   │   └── deepseek-web-client.ts    # DeepSeek API client
│   ├── agents/
│   │   └── deepseek-web-stream.ts    # Streaming response handler
│   ├── commands/
│   │   └── auth-choice.apply.deepseek-web.ts  # Authentication flow
│   └── browser/
│       └── chrome.ts                 # Chrome automation
├── ui/                               # Web UI (Lit 3.x)
├── .openclaw-state/                  # Local state (not committed)
│   ├── openclaw.json                 # Configuration
│   └── agents/main/agent/
│       └── auth.json                 # Credentials (sensitive)
└── .gitignore                        # Includes .openclaw-state/
```

---

## Security Notes

1. **Credential Storage**: Cookies and Bearer tokens are stored locally in `auth.json`, **never committed to Git**
2. **Session Expiry**: Web sessions may expire and require periodic re-login
3. **Rate Limits**: Web APIs may have rate limits, not suitable for high-frequency calls
4. **Compliance**: For personal learning and research only, please comply with platform terms of service

---

## Syncing with Upstream

This project is based on OpenClaw. Sync upstream updates with:

```bash
# Add upstream repository
git remote add upstream https://github.com/openclaw/openclaw.git

# Sync upstream updates
git fetch upstream
git merge upstream/main
```

---

## Contributing

Contributions are welcome, especially:
- New platform Web authentication support (Doubao, Claude, ChatGPT, etc.)
- Bug fixes
- Documentation improvements

---

## License

[MIT License](LICENSE)

---

## Acknowledgments

- [OpenClaw](https://github.com/openclaw/openclaw) - The original project
- [DeepSeek](https://deepseek.com) - Excellent AI models

---

## Disclaimer

This project is for learning and research purposes only. When using this project to access any third-party services, please ensure compliance with that service's terms of use. The developers are not responsible for any issues arising from the use of this project.
