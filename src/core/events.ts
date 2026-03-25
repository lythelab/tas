import { randomUUID } from "node:crypto";
import { AgentEvent, AgentEventName } from "../types";

type Listener = (event: AgentEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export class EventStore {
  private readonly maxItems: number;
  private events: AgentEvent[] = [];

  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }

  push(event: Omit<AgentEvent, "id" | "ts">): AgentEvent {
    const withMeta: AgentEvent = {
      ...event,
      id: randomUUID(),
      ts: Date.now()
    };
    this.events.push(withMeta);
    if (this.events.length > this.maxItems) {
      this.events = this.events.slice(this.events.length - this.maxItems);
    }
    return withMeta;
  }

  list(limit = 200): AgentEvent[] {
    return this.events.slice(Math.max(0, this.events.length - limit));
  }

  stats(): Record<AgentEventName, number> {
    const base: Record<AgentEventName, number> = {
      message_received: 0,
      llm_called: 0,
      tool_called: 0,
      response_sent: 0,
      runtime_error: 0
    };

    for (const event of this.events) {
      base[event.event] += 1;
    }

    return base;
  }
}
