import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { getHeadersWithAuth } from "../browser/cdp.helpers.js";
import {
  launchOpenClawChrome,
  stopOpenClawChrome,
  getChromeWebSocketUrl,
  isChromeReachable,
} from "../browser/chrome.js";
import { resolveBrowserConfig, resolveProfile } from "../browser/config.js";
import { loadConfig } from "../config/io.js";

export interface DoubaoAuth {
  sessionid: string;
  ttwid?: string;
  userAgent: string;
  // 动态参数（可选，可以从浏览器实时获取）
  msToken?: string;
  a_bogus?: string;
  fp?: string; // s_v_web_id
  tea_uuid?: string;
  device_id?: string;
  web_tab_id?: string;
  aid?: string;
  version_code?: string;
  pc_version?: string;
  region?: string;
  language?: string;
}

const DEFAULT_CDP_PORT = 9222;

export async function loginDoubaoWeb(params: {
  onProgress: (msg: string) => void;
  openUrl: (url: string) => Promise<boolean>;
  useExistingChrome?: boolean;
  existingCdpPort?: number;
  useExistingChromeData?: boolean;
}) {
  const { 
    useExistingChrome = false, 
    existingCdpPort = DEFAULT_CDP_PORT,
    useExistingChromeData = false
  } = params;

  let running: any;
  
  if (useExistingChrome) {
    const cdpUrl = `http://127.0.0.1:${existingCdpPort}`;
    params.onProgress(`Connecting to existing Chrome on ${cdpUrl}...`);
    
    const isReachable = await isChromeReachable(cdpUrl, 1000);
    if (!isReachable) {
      throw new Error(
        `Cannot connect to Chrome on port ${existingCdpPort}. ` +
        `Please start Chrome with: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${existingCdpPort}`
      );
    }
    
    running = { cdpPort: existingCdpPort };
  } else if (useExistingChromeData) {
    // 使用现有Chrome的用户数据
    const rootConfig = loadConfig();
    const browserConfig = resolveBrowserConfig(rootConfig.browser, rootConfig);
    const profile = resolveProfile(browserConfig, browserConfig.defaultProfile);
    if (!profile) {
      throw new Error(`Could not resolve browser profile '${browserConfig.defaultProfile}'`);
    }

    params.onProgress("Launching Chrome with existing user data...");
    
    // 修改用户数据目录为现有Chrome的目录
    const existingUserDataDir = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
    
    // 临时修改配置以使用现有用户数据
    const modifiedConfig = {
      ...browserConfig,
      userDataDir: existingUserDataDir
    };
    
    running = await launchOpenClawChrome(modifiedConfig, profile);
  } else {
    const rootConfig = loadConfig();
    const browserConfig = resolveBrowserConfig(rootConfig.browser, rootConfig);
    const profile = resolveProfile(browserConfig, browserConfig.defaultProfile);
    if (!profile) {
      throw new Error(`Could not resolve browser profile '${browserConfig.defaultProfile}'`);
    }

    params.onProgress("Launching browser...");
    running = await launchOpenClawChrome(browserConfig, profile);
  }

  try {
    const cdpUrl = `http://127.0.0.1:${running.cdpPort}`;
    let wsUrl: string | null = null;

    params.onProgress("Waiting for browser debugger...");
    for (let i = 0; i < 10; i++) {
      wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
      if (wsUrl) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!wsUrl) {
      throw new Error(`Failed to resolve Chrome WebSocket URL from ${cdpUrl} after retries.`);
    }

    params.onProgress("Connecting to browser...");
    const browser = await chromium.connectOverCDP(wsUrl, {
      headers: getHeadersWithAuth(wsUrl),
    });
    const context = browser.contexts()[0];
    const page = context.pages()[0] || (await context.newPage());

    await page.goto("https://www.doubao.com/chat/");
    const userAgent = await page.evaluate(() => navigator.userAgent);

    params.onProgress("Please login to Doubao in the opened browser window...");

    return await new Promise<DoubaoAuth>((resolve, reject) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          reject(new Error("Login timed out (5 minutes)."));
        }
      }, 300000);

      const tryResolve = async () => {
        if (resolved) {
          return;
        }

        try {
          const cookies = await context.cookies([
            "https://www.doubao.com",
            "https://doubao.com",
          ]);
          if (cookies.length === 0) {
            console.log(`[Doubao] No cookies found in context yet.`);
            return;
          }

          const cookieNames = cookies.map((c) => c.name);
          console.log(`[Doubao] Found cookies: ${cookieNames.join(", ")}`);

          const sessionidCookie = cookies.find((c) => c.name === "sessionid");
          const ttwidCookie = cookies.find((c) => c.name === "ttwid");
          const fpCookie = cookies.find((c) => c.name === "s_v_web_id");

          if (sessionidCookie) {
            resolved = true;
            clearTimeout(timeout);
            console.log(`[Doubao] sessionid captured!`);
            
            // 尝试从页面中提取动态参数
            let msToken: string | undefined;
            let a_bogus: string | undefined;
            let tea_uuid: string | undefined;
            let device_id: string | undefined;
            let web_tab_id: string | undefined;
            let aid: string | undefined;
            let version_code: string | undefined;
            let pc_version: string | undefined;
            let region: string | undefined;
            let language: string | undefined;
            
            try {
              // 从页面中提取可能的动态参数
              const pageState = await page.evaluate(() => {
                const state: Record<string, string> = {};
                
                // 尝试从localStorage获取
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && key.includes('token') || key?.includes('uuid') || key?.includes('id')) {
                    state[key] = localStorage.getItem(key) || '';
                  }
                }
                
                // 尝试从sessionStorage获取
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (key && key.includes('token') || key?.includes('uuid') || key?.includes('id')) {
                    state[key] = sessionStorage.getItem(key) || '';
                  }
                }
                
                // 尝试从window对象获取
                if ((window as any).__DOUBAO_CONFIG__) {
                  const config = (window as any).__DOUBAO_CONFIG__;
                  Object.assign(state, config);
                }
                
                return state;
              });
              
              // 从页面状态中提取参数
              msToken = pageState.msToken || pageState.token;
              tea_uuid = pageState.tea_uuid || pageState.uuid;
              device_id = pageState.device_id;
              web_tab_id = pageState.web_tab_id;
              aid = pageState.aid;
              version_code = pageState.version_code;
              pc_version = pageState.pc_version;
              region = pageState.region;
              language = pageState.language;
              
              console.log(`[Doubao] Extracted page state keys: ${Object.keys(pageState).join(', ')}`);
            } catch (e) {
              console.warn(`[Doubao] Failed to extract page state: ${String(e)}`);
            }
            
            resolve({
              sessionid: sessionidCookie.value,
              ttwid: ttwidCookie?.value,
              userAgent,
              fp: fpCookie?.value,
              msToken,
              a_bogus,
              tea_uuid,
              device_id,
              web_tab_id,
              aid,
              version_code,
              pc_version,
              region,
              language,
            });
          } else {
            console.log(`[Doubao] Waiting for sessionid cookie...`);
          }
        } catch (e: unknown) {
          console.error(`[Doubao] Failed to fetch cookies: ${String(e)}`);
        }
      };

      page.on("request", async (request) => {
        const url = request.url();
        if (url.includes("doubao.com") || url.includes("bytedance")) {
          const headers = request.headers();
          if (headers["cookie"]?.includes("sessionid")) {
            console.log(`[Doubao] Found sessionid in request cookie.`);
            await tryResolve();
          }
          
          // 尝试从请求URL中提取动态参数
          if (url.includes("chat/completion")) {
            try {
              const urlObj = new URL(url);
              const msToken = urlObj.searchParams.get("msToken");
              const a_bogus = urlObj.searchParams.get("a_bogus");
              const device_id = urlObj.searchParams.get("device_id");
              const web_tab_id = urlObj.searchParams.get("web_tab_id");
              
              if (msToken || a_bogus) {
                console.log(`[Doubao] Found dynamic params in request: msToken=${msToken ? 'yes' : 'no'}, a_bogus=${a_bogus ? 'yes' : 'no'}`);
                
                // 这里可以存储这些参数，但更好的方式是在登录完成后从页面中提取
              }
            } catch (e) {
              // 忽略URL解析错误
            }
          }
        }
      });

      page.on("response", async (response) => {
        const url = response.url();
        if (url.includes("doubao.com") && response.ok()) {
          await tryResolve();
        }
      });

      page.on("close", () => {
        reject(new Error("Browser window closed before login was captured."));
      });

      const checkInterval = setInterval(async () => {
        await tryResolve();
        if (resolved) {
          clearInterval(checkInterval);
        }
      }, 2000);
    });
  } finally {
    if (!useExistingChrome && running) {
      await stopOpenClawChrome(running);
    }
  }
}
