import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { AgentRuntime } from "./runtime";
import { EventBus, EventStore } from "./events";
import { DevDashboard } from "../dev/dashboard";
import { TelegramClient } from "../telegram/client";
import { createLLMAdapter } from "../llm";
import { createMemory } from "../memory";
import { AgentOptions, TelegramUpdate, TelegramWebhookHandler } from "../types";
import { normalizePath, readJsonBody } from "../utils/http";

type TelegramAgent = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  handler: () => TelegramWebhookHandler;
  processUpdate: (update: TelegramUpdate, headers?: Record<string, string | string[] | undefined>) => Promise<void>;
  events: EventStore;
  onEvent: (listener: (event: ReturnType<EventStore["push"]>) => void) => () => void;
};

export function createTelegramAgent(options: AgentOptions): TelegramAgent {
  if (!options.token) {
    throw new Error("Telegram bot token is required");
  }

  const webhookPath = normalizePath(options.webhook?.path ?? "/webhook");
  const port = options.webhook?.port ?? 3000;
  const secretToken = options.webhook?.secretToken;
  const isDev = options.isDev ?? false;
  const devPort = options.dev?.port ?? 5173;
  const devHost = options.dev?.host ?? "127.0.0.1";
  const typingEnabled = typeof options.typing === "boolean" ? options.typing : options.typing?.enabled ?? true;
  const typingIntervalMs = typeof options.typing === "object" ? options.typing.intervalMs : undefined;

  const eventBus = new EventBus();
  const eventStore = new EventStore();
  const memory = options.memory ?? createMemory({ provider: "memory", limit: options.memoryLimit ?? 10 });
  const telegram = new TelegramClient(options.token);
  const llm = createLLMAdapter(options);

  const runtime = new AgentRuntime({
    model: llm.model,
    llm: llm.adapter,
    tools: options.tools ?? [],
    systemPrompt: options.systemPrompt,
    memory,
    eventStore,
    eventBus,
    sendMessage: (chatId, text) => telegram.sendMessage(chatId, text),
    sendTyping: typingEnabled ? (chatId) => telegram.sendChatAction(chatId, "typing") : undefined,
    typingIntervalMs
  });

  const dashboard = isDev ? new DevDashboard(eventStore, eventBus, { port: devPort, host: devHost }) : undefined;

  let server: Server | undefined;
  let initialized = false;

  const ensureReady = async (): Promise<void> => {
    if (initialized) {
      return;
    }
    await memory.init();
    initialized = true;
  };

  const processUpdate = async (
    update: TelegramUpdate,
    headers?: Record<string, string | string[] | undefined>
  ): Promise<void> => {
    await ensureReady();

    if (secretToken) {
      const incoming = headerValue(headers, "x-telegram-bot-api-secret-token");
      if (!incoming || incoming !== secretToken) {
        throw new Error("Invalid webhook secret token");
      }
    }

    const text = update.message?.text;
    const chatId = update.message?.chat?.id;

    if (!text || !chatId) {
      return;
    }

    await runtime.processIncomingMessage(chatId, text);
  };

  const handler = (): TelegramWebhookHandler => {
    return async (body, headers) => {
      await processUpdate(body as TelegramUpdate, headers);
    };
  };

  const start = async (): Promise<void> => {
    await ensureReady();
    if (isDev && dashboard) {
      await dashboard.start();
    }

    if (options.webhook?.external) {
      console.log("[tas] external webhook mode enabled, skipping built-in HTTP server");
      if (isDev && dashboard) {
        console.log(`[tas] dev dashboard: ${dashboard.url()}`);
      }
      return;
    }

    if (server) {
      return;
    }

    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = normalizePath((req.url ?? "/").split("?")[0]);

      if (req.method === "POST" && url === webhookPath) {
        try {
          const body = (await readJsonBody(req)) as TelegramUpdate;
          const headers = req.headers as Record<string, string | string[] | undefined>;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end("{\"ok\":true}");

          void processUpdate(body, headers).catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            eventStore.push({
              event: "runtime_error",
              payload: { error: message },
              chatId: String(body.message?.chat?.id ?? "unknown")
            });
          });
          return;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end("{\"ok\":false,\"error\":\"invalid_json\"}");
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end("{\"ok\":false,\"error\":\"not_found\"}");
    });

    await new Promise<void>((resolve) => {
      server?.listen(port, resolve);
    });

    const shouldRegister = options.webhook?.autoRegister ?? true;
    if (shouldRegister && options.webhook?.url) {
      const finalUrl = `${options.webhook.url.replace(/\/$/, "")}${webhookPath}`;
      await telegram.setWebhook(finalUrl, { secretToken });
      console.log(`[tas] webhook registered: ${finalUrl}`);
    }

    console.log(`[tas] listening on :${port}${webhookPath}`);
    if (isDev) {
      console.log(`[tas] dev dashboard: ${dashboard?.url() ?? `http://${devHost}:${devPort}`}`);
    }
  };

  const stop = async (): Promise<void> => {
    await memory.close();
    if (dashboard) {
      await dashboard.stop();
    }

    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });

    server = undefined;
  };

  return {
    start,
    stop,
    handler,
    processUpdate,
    events: eventStore,
    onEvent: (listener) => eventBus.subscribe(listener)
  };
}

function headerValue(
  headers?: Record<string, string | string[] | undefined>,
  name?: string
): string | undefined {
  if (!headers || !name) {
    return undefined;
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
