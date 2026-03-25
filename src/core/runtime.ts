import { EventBus, EventStore } from "./events";
import { ToolExecutor } from "../tools/executor";
import { LLMAdapter, LLMMessage, MemoryLayer, Tool } from "../types";

type RuntimeConfig = {
  model: string;
  llm: LLMAdapter;
  tools: Tool[];
  systemPrompt?: string;
  memory: MemoryLayer;
  eventStore: EventStore;
  eventBus: EventBus;
  sendMessage: (chatId: number | string, text: string) => Promise<void>;
  sendTyping?: (chatId: number | string) => Promise<void>;
  typingIntervalMs?: number;
};

export class AgentRuntime {
  private readonly model: string;
  private readonly llm: LLMAdapter;
  private readonly tools: ToolExecutor;
  private readonly systemPrompt?: string;
  private readonly memory: MemoryLayer;
  private readonly eventStore: EventStore;
  private readonly eventBus: EventBus;
  private readonly sendMessage: (chatId: number | string, text: string) => Promise<void>;
  private readonly sendTyping?: (chatId: number | string) => Promise<void>;
  private readonly typingIntervalMs: number;

  constructor(config: RuntimeConfig) {
    this.model = config.model;
    this.llm = config.llm;
    this.tools = new ToolExecutor(config.tools);
    this.systemPrompt = config.systemPrompt;
    this.memory = config.memory;
    this.eventStore = config.eventStore;
    this.eventBus = config.eventBus;
    this.sendMessage = config.sendMessage;
    this.sendTyping = config.sendTyping;
    this.typingIntervalMs = config.typingIntervalMs ?? 3500;
  }

  async processIncomingMessage(chatId: number, text: string): Promise<void> {
    const chatKey = String(chatId);
    const stopTyping = this.startTyping(chatId);

    this.emit("message_received", chatKey, { text });

    const userMessage: LLMMessage = { role: "user", content: text };
    await this.memory.add(chatKey, userMessage);

    const context = await this.buildContext(chatKey);

    try {
      let completion = await this.callLLM(chatKey, context);
      let rounds = 0;

      while (completion.toolCalls.length > 0 && rounds < 3) {
        rounds += 1;

        context.push({
          role: "assistant",
          content: completion.text,
          toolCalls: completion.toolCalls
        });

        for (const toolCall of completion.toolCalls) {
          const result = await this.tools.execute(toolCall.name, toolCall.arguments);
          const serialized = safeStringify(result);

          this.emit("tool_called", chatKey, {
            tool: toolCall.name,
            arguments: toolCall.arguments,
            result
          });

          context.push({
            role: "tool",
            name: toolCall.name,
            toolCallId: toolCall.id,
            content: serialized
          });
        }

        completion = await this.callLLM(chatKey, context);
      }

      const textOut = completion.text?.trim() || "Done.";
      await this.sendMessage(chatId, textOut);

      this.emit("response_sent", chatKey, { text: textOut });
      await this.memory.add(chatKey, { role: "assistant", content: textOut });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("runtime_error", chatKey, { error: message });
      await this.sendMessage(chatId, `Runtime error: ${message}`);
    } finally {
      stopTyping();
    }
  }

  private async buildContext(chatId: string): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = [];
    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt });
    }
    messages.push(...(await this.memory.get(chatId)));
    return messages;
  }

  private async callLLM(chatId: string, messages: LLMMessage[]) {
    this.emit("llm_called", chatId, {
      model: this.model,
      messageCount: messages.length,
      tools: this.tools.list().map((tool) => tool.name)
    });

    return this.llm.complete({
      model: this.model,
      messages,
      tools: this.tools.list()
    });
  }

  private emit(event: Parameters<EventStore["push"]>[0]["event"], chatId: string, payload: Record<string, unknown>): void {
    const entry = this.eventStore.push({
      event,
      chatId,
      payload
    });
    this.eventBus.emit(entry);
  }

  private startTyping(chatId: number): () => void {
    if (!this.sendTyping) {
      return () => undefined;
    }

    void this.sendTyping(chatId).catch(() => undefined);
    const timer = setInterval(() => {
      void this.sendTyping?.(chatId).catch(() => undefined);
    }, this.typingIntervalMs);

    return () => clearInterval(timer);
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
