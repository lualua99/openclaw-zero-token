import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEvent,
  type TextContent,
} from "@mariozechner/pi-ai";
import { DoubaoWebClient, type DoubaoMessage } from "../providers/doubao-web-client.js";

export function createDoubaoWebStreamFn(auth: string): StreamFn {
  let options: any;
  try {
    const parsed = JSON.parse(auth);
    options = typeof parsed === "string" ? { sessionid: parsed } : parsed;
  } catch {
    options = { sessionid: auth };
  }
  
  console.log(`[DoubaoWebStream] Auth options keys: ${Object.keys(options).join(', ')}`);
  console.log(`[DoubaoWebStream] Has fp: ${!!options.fp}, fp value: ${options.fp}`);
  console.log(`[DoubaoWebStream] Has tea_uuid: ${!!options.tea_uuid}, tea_uuid value: ${options.tea_uuid}`);
  console.log(`[DoubaoWebStream] Has device_id: ${!!options.device_id}, device_id value: ${options.device_id}`);
  console.log(`[DoubaoWebStream] Has web_tab_id: ${!!options.web_tab_id}, web_tab_id value: ${options.web_tab_id}`);
  
  const client = new DoubaoWebClient(options);

  return (model, context, streamOptions) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        const messages = context.messages || [];
        const doubaoMessages: DoubaoMessage[] = messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content:
            typeof m.content === "string"
              ? m.content
              : Array.isArray(m.content)
                ? m.content
                    .filter((p) => p.type === "text")
                    .map((p) => (p as TextContent).text)
                    .join("")
                : "",
        }));

        const modelId = model.id.includes("/") ? model.id.split("/")[1] : model.id;

        console.log(`[DoubaoWebStream] Starting stream for model: ${modelId}`);
        console.log(`[DoubaoWebStream] Messages count: ${doubaoMessages.length}`);

        const responseStream = await client.chatCompletions({
          model: modelId,
          messages: doubaoMessages,
          stream: true,
        });

        if (
          !responseStream ||
          !(Symbol.asyncIterator in Object(responseStream))
        ) {
          throw new Error("Doubao Web API returned empty response");
        }

        const contentParts: TextContent[] = [];
        let accumulatedContent = "";
        let contentIndex = 0;
        let textStarted = false;

        const createPartial = (): AssistantMessage => ({
          role: "assistant",
          content: [...contentParts],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        });

        for await (const chunk of responseStream as AsyncIterable<string>) {
          if (!chunk) continue;

          if (!textStarted) {
            textStarted = true;
            contentParts[contentIndex] = { type: "text", text: "" };
            stream.push({ type: "text_start", contentIndex, partial: createPartial() });
          }

          contentParts[contentIndex].text += chunk;
          accumulatedContent += chunk;
          stream.push({
            type: "text_delta",
            contentIndex,
            delta: chunk,
            partial: createPartial(),
          });
        }

        console.log(`[DoubaoWebStream] Stream completed. Content length: ${accumulatedContent.length}`);

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: contentParts,
          stopReason: "stop",
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          timestamp: Date.now(),
        };

        stream.push({
          type: "done",
          reason: "stop",
          message: assistantMessage,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[DoubaoWebStream] Error: ${errorMessage}`);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage,
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        } as AssistantMessageEvent);
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
