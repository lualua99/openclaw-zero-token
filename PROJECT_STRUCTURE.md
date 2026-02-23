# OpenClaw Zero Token - 项目文件结构说明

本文档用于区分 OpenClaw 原有文件和我们添加/修改的 DeepSeek 相关文件，方便后续从上游 OpenClaw 更新代码。

---

## 目录结构

### 一、OpenClaw 原有文件（上游文件）

这些文件直接来自 OpenClaw 上游仓库，后续更新时会被覆盖：

- `.github/` - GitHub 配置和工作流
- `apps/` - 移动应用（Android、iOS、macOS）
- `extensions/` - OpenClaw 扩展插件
- `packages/` - 独立包
- `patches/` - 补丁文件
- `scripts/` - 构建和部署脚本
- `skills/` - OpenClaw 技能（除了我们添加的）
- `test/` - 测试文件
- `src/` - 核心源代码（大部分）
- `ui/` - UI 源代码（大部分）
- 根目录配置文件：`.env.example`, `.gitattributes`, `.npmrc`, `.oxfmtrc.jsonc`, `.oxlintrc.json`, `.pre-commit-config.yaml`, `.secrets.baseline`, `.shellcheckrc`, `.swiftformat`, `.swiftlint.yml`, `fly.private.toml`, `fly.toml`, `git-hooks/`, `onboard.sh`, `openclaw.mjs`, `openclaw.podman.env`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `render.yaml`, `server.sh`, `setup-podman.sh`, `tsconfig.json`, `tsconfig.plugin-sdk.dts.json`, `tsdown.config.ts`, `vitest.config.ts`, `vitest.e2e.config.ts`, `vitest.extensions.config.ts`, `vitest.gateway.config.ts`, `vitest.live.config.ts`, `vitest.unit.config.ts`, `zizmor.yml`

---

### 二、我们添加的 DeepSeek 相关文件

这些是我们为 DeepSeek 网页版认证功能新增的文件，**不会被上游更新覆盖**：

| 文件路径 | 说明 |
|---------|------|
| `src/providers/deepseek-web-auth.ts` | DeepSeek 网页版认证处理 |
| `src/providers/deepseek-web-client.ts` | DeepSeek 网页版 API 客户端 |
| `src/agents/deepseek-web-stream.ts` | DeepSeek 流式响应处理 |
| `ui/src/ui/components/chat-thinking.ts` | 思考过程 UI 组件 |
| `deepseek-reasoner-config.example.json` | DeepSeek 配置示例 |
| `test-auth.js` | 认证测试脚本 |
| `README.md` | 英文项目文档 |
| `README_zh-CN.md` | 中文项目文档 |
| `openclawdeepseek.mp4` | 演示视频 |
| `PROJECT_STRUCTURE.md` | 本文档 |

---

### 三、我们修改的 OpenClaw 原有文件

这些是我们修改过的 OpenClaw 原有文件，**从上游更新时需要小心处理冲突**：

| 文件路径 | 修改内容 |
|---------|---------|
| `src/agents/defaults.ts` | 添加 DeepSeek 默认配置 |
| `src/agents/model-auth.ts` | 添加 DeepSeek 认证支持 |
| `src/agents/models-config.providers.ts` | 添加 DeepSeek 提供者配置 |
| `src/agents/run/extra-params.ts` | 添加 DeepSeek 额外参数 |
| `src/agents/run/attempt.ts` | 修改模型运行尝试逻辑 |
| `src/agents/system-prompt.ts` | 修改系统提示 |
| `src/agents/tools/browser-tool.schema.ts` | 添加浏览器工具 Schema |
| `src/agents/tools/browser-tool.ts` | 修改浏览器工具实现 |
| `src/commands/auth-choice-options.ts` | 添加 DeepSeek 认证选项 |
| `src/commands/auth-choice.apply.deepseek-web.ts` | DeepSeek 认证应用逻辑 |
| `src/commands/auth-choice.apply.ts` | 修改认证选择应用 |
| `src/commands/onboard-auth.config-core.ts` | 添加 DeepSeek 配置 |
| `src/commands/onboard-auth.credentials.ts` | 添加 DeepSeek 凭证 |
| `src/commands/onboard-auth.models.ts` | 添加 DeepSeek 模型 |
| `src/config/types.models.ts` | 修改模型类型定义 |
| `src/config/zod-schema.core.ts` | 添加核心配置 Schema |
| `src/shared/text/reasoning-tags.ts` | 修改思考标签解析 |
| `src/utils/provider-utils.ts` | 添加提供者工具函数 |
| `ui/src/ui/chat/grouped-render.ts` | 修改聊天渲染 |
| `ui/src/ui/chat/message-extract.ts` | 修改消息提取 |
| `ui/src/ui/format.ts` | 修改格式化 |
| `.gitignore` | 添加敏感文件忽略规则 |

---

## Git 提交历史

关键提交：
- `813b16f55` - docs: add README in English and Chinese, add demo video
- `5e0c96f15` - Initial commit: OpenClaw with DeepSeek web auth support
- `8e2015f7a` - feat: implement DeepSeek Web client, reasoning tag extraction, and UI thinking box components

---

## 从上游 OpenClaw 更新的步骤

1. 添加上游 remote（如果还没有）：
   ```bash
   git remote add upstream https://github.com/openclaw/openclaw.git
   ```

2. 获取上游更新：
   ```bash
   git fetch upstream
   ```

3. 合并上游更新（推荐使用 rebase 保持历史清晰）：
   ```bash
   git rebase upstream/main
   ```

4. 解决冲突（重点关注上述"修改的文件"列表）

5. 测试确保 DeepSeek 功能正常

6. 推送到自己的仓库：
   ```bash
   git push -f origin main
   ```

---

**注意：** 更新前请确保当前工作区干净，或者先提交/暂存你的修改。
