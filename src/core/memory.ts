import { LLMMessage, MemoryLayer } from "../types";

export class InMemoryLayer implements MemoryLayer {
  readonly provider = "memory" as const;
  private readonly maxMessages: number;
  private readonly byChat = new Map<string, LLMMessage[]>();

  constructor(maxMessages = 10) {
    this.maxMessages = maxMessages;
  }

  async init(): Promise<void> {
    return;
  }

  async add(chatId: string, message: LLMMessage): Promise<void> {
    const current = this.byChat.get(chatId) ?? [];
    current.push(message);
    const trimmed = current.slice(Math.max(0, current.length - this.maxMessages));
    this.byChat.set(chatId, trimmed);
  }

  async get(chatId: string): Promise<LLMMessage[]> {
    return [...(this.byChat.get(chatId) ?? [])];
  }

  async clear(chatId: string): Promise<void> {
    this.byChat.delete(chatId);
  }

  async close(): Promise<void> {
    return;
  }
}
