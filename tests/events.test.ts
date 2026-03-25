import { describe, expect, it } from "vitest";
import { EventStore } from "../src/core/events";

describe("EventStore", () => {
  it("tracks event stats", () => {
    const store = new EventStore();

    store.push({ event: "message_received", chatId: "1", payload: {} });
    store.push({ event: "tool_called", chatId: "1", payload: {} });
    store.push({ event: "tool_called", chatId: "1", payload: {} });

    const stats = store.stats();
    expect(stats.message_received).toBe(1);
    expect(stats.tool_called).toBe(2);
  });
});
