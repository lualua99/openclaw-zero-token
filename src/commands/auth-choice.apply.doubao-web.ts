import { loginDoubaoWeb } from "../providers/doubao-web-auth.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyDoubaoWebConfig } from "./onboard-auth.config-core.js";
import { setDoubaoWebCookie } from "./onboard-auth.credentials.js";
import { openUrl } from "./onboard-helpers.js";

export async function applyAuthChoiceDoubaoWeb(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "doubao-web") {
    return null;
  }

  const { prompter, runtime, config, agentDir, opts } = params;

  let sessionid = opts?.doubaoWebCookie?.trim();
  let ttwid: string | undefined;

  if (!sessionid) {
    const mode = await prompter.select({
      message: "Doubao Auth Mode",
      options: [
        {
          value: "auto",
          label: "Automated Login (Recommended)",
          hint: "Opens browser to capture login automatically",
        },
        {
          value: "existing",
          label: "Use Existing Chrome",
          hint: "Connect to your existing Chrome with remote debugging",
        },
        {
          value: "manual",
          label: "Manual Paste",
          hint: "Paste sessionid cookie manually",
        },
      ],
    });

    if (mode === "existing") {
      await prompter.note(
        [
          "To use your existing Chrome:",
          "1. Start Chrome with remote debugging:",
          "   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222",
          "2. Login to https://www.doubao.com/chat/ in that Chrome",
          "3. Click 'Continue' below",
        ].join("\n"),
        "Use Existing Chrome",
      );

      const spin = prompter.progress("Connecting to existing Chrome...");
      try {
        const result = await loginDoubaoWeb({
          onProgress: (msg) => spin.update(msg),
          openUrl: async (url) => {
            await openUrl(url);
            return true;
          },
          useExistingChrome: true,
          existingCdpPort: 9222,
        });
        spin.stop("Connected to existing Chrome successfully!");
        sessionid = result.sessionid;
        ttwid = result.ttwid;
        const authData = JSON.stringify({
          sessionid: result.sessionid,
          ttwid: result.ttwid,
          userAgent: result.userAgent,
          fp: result.fp,
          tea_uuid: result.tea_uuid,
          device_id: result.device_id,
          web_tab_id: result.web_tab_id,
          msToken: result.msToken,
          a_bogus: result.a_bogus,
          aid: result.aid,
          version_code: result.version_code,
          pc_version: result.pc_version,
          region: result.region,
          language: result.language,
        });
        await setDoubaoWebCookie({ cookie: authData }, agentDir);
      } catch (err) {
        spin.stop("Failed to connect to existing Chrome.");
        runtime.error(String(err));
        const retryManual = await prompter.confirm({
          message: "Would you like to try manual paste instead?",
          initialValue: true,
        });
        if (!retryManual) {
          throw err;
        }
      }
    } else if (mode === "auto") {
      const spin = prompter.progress("Preparing automated login...");
      try {
        const result = await loginDoubaoWeb({
          onProgress: (msg) => spin.update(msg),
          openUrl: async (url) => {
            await openUrl(url);
            return true;
          },
        });
        spin.stop("Login captured successfully!");
        sessionid = result.sessionid;
        ttwid = result.ttwid;
        const authData = JSON.stringify({
          sessionid: result.sessionid,
          ttwid: result.ttwid,
          userAgent: result.userAgent,
          fp: result.fp,
          tea_uuid: result.tea_uuid,
          device_id: result.device_id,
          web_tab_id: result.web_tab_id,
          msToken: result.msToken,
          a_bogus: result.a_bogus,
        });
        await setDoubaoWebCookie({ cookie: authData }, agentDir);
      } catch (err) {
        spin.stop("Automated login failed.");
        runtime.error(String(err));
        const retryManual = await prompter.confirm({
          message: "Would you like to try manual paste instead?",
          initialValue: true,
        });
        if (!retryManual) {
          throw err;
        }
      }
    }

    if (!sessionid) {
      await prompter.note(
        [
          "To use Doubao Browser, you need the sessionid cookie from www.doubao.com.",
          "1. Login to https://www.doubao.com/chat/",
          "2. Open DevTools (F12) -> Application -> Cookies",
          "3. Find and copy the 'sessionid' cookie value",
          "4. Optionally also copy 'ttwid' cookie",
        ].join("\n"),
        "Doubao Login",
      );

      sessionid = (await prompter.text({
        message: "Paste sessionid cookie",
        hint: "The sessionid value from cookies",
        placeholder: "...",
        validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
      }));

      ttwid = (await prompter.text({
        message: "Paste ttwid cookie (Optional)",
        hint: "The ttwid value from cookies - optional but recommended",
        placeholder: "Optional",
      }));

      const authData = JSON.stringify({
        sessionid,
        ttwid: ttwid || undefined,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // 手动模式无法获取动态参数，需要后续从浏览器中提取
      });
      await setDoubaoWebCookie({ cookie: authData }, agentDir);
    }
  } else {
    await setDoubaoWebCookie({ cookie: sessionid }, agentDir);
  }

  const nextConfig = await applyDoubaoWebConfig(config);

  return { config: nextConfig };
}
