import type { OpenClawConfig } from "../config/config.js";
import { upsertAuthProfile } from "../agents/auth-profiles.js";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyDoubaoProxyConfig } from "./onboard-auth.config-core.js";

const DEFAULT_DOUBAO_PROXY_BASE_URL = "http://127.0.0.1:8000/v1";
const DOUBAO_PROXY_MODEL_ID = "doubao";

export async function applyAuthChoiceDoubaoProxy(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "doubao-proxy") {
    return null;
  }

  const { prompter, runtime, config, agentDir, setDefaultModel, opts } = params;

  await prompter.note(
    [
      "Doubao via doubao-free-api proxy:",
      "1. Deploy: docker run -d -p 8000:8000 linuxhsj/doubao-free-api:latest",
      "2. Get sessionid from https://www.doubao.com (F12 → Application → Cookies)",
      "3. Uses Authorization: Bearer <sessionid>",
    ].join("\n"),
    "Doubao Proxy Setup",
  );

  const baseUrlOpt = (opts as { doubaoProxyBaseUrl?: string })?.doubaoProxyBaseUrl?.trim();
  let baseUrl = baseUrlOpt;
  if (!baseUrl) {
    const raw = await prompter.text({
      message: "doubao-free-api base URL",
      initialValue: DEFAULT_DOUBAO_PROXY_BASE_URL,
      placeholder: DEFAULT_DOUBAO_PROXY_BASE_URL,
    });
    baseUrl = raw?.trim() || DEFAULT_DOUBAO_PROXY_BASE_URL;
  }
  if (!baseUrl.startsWith("http")) {
    baseUrl = `http://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, "");

  let sessionid = (opts as { doubaoProxySessionId?: string })?.doubaoProxySessionId?.trim();
  if (!sessionid) {
    sessionid = await prompter.text({
      message: "Paste sessionid (from doubao.com cookies)",
      hint: "Used as Bearer token by doubao-free-api",
      placeholder: "6750e5af32eb15976...",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    });
  }

  const agentDirResolved = agentDir ?? resolveOpenClawAgentDir();
  upsertAuthProfile({
    profileId: "doubao-proxy:default",
    credential: {
      type: "api_key",
      provider: "doubao-proxy",
      key: sessionid.trim(),
    },
    agentDir: agentDirResolved,
  });

  const nextConfig = applyDoubaoProxyConfig(config, {
    baseUrl,
    modelId: DOUBAO_PROXY_MODEL_ID,
  });

  if (setDefaultModel) {
    await prompter.note(`Default model set to doubao-proxy/${DOUBAO_PROXY_MODEL_ID}`, "Configured");
  }

  return {
    config: nextConfig,
    agentModelOverride: setDefaultModel ? undefined : `doubao-proxy/${DOUBAO_PROXY_MODEL_ID}`,
  };
}
