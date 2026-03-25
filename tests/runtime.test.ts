import { describe, expect, it, vi } from "vitest";
import { AgentRuntime } from "../src/core/runtime";
import { EventBus, EventStore } from "../src/core/events";
import { InMemoryLayer } from "../src/core/memory";
import { LLMAdapter } from "../src/types";

describe("AgentRuntime", () => {
  it("handles tool-calling loop and sends final answer", async () => {
    const llm: LLMAdapter = {
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          text: "",
          toolCalls: [{ id: "call_1", name: "weather", arguments: "{\"city\":\"Bengaluru\"}" }]
        })
        .mockResolvedValueOnce({
          text: "It is 28C in Bengaluru.",
          toolCalls: []
        })
    };

    const sendMessage = vi.fn().mockResolvedValue(undefined);

    const runtime = new AgentRuntime({
      model: "test-model",
      llm,
      tools: [
        {
          name: "weather",
          description: "get weather",
          execute: async ({ city }) => ({ city, tempC: 28 })
        }
      ],
      systemPrompt: "You are helpful",
      memory: new InMemoryLayer(10),
      eventStore: new EventStore(),
      eventBus: new EventBus(),
      sendMessage
    });

    await runtime.processIncomingMessage(123, "Weather?");

    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(123, "It is 28C in Bengaluru.");
  });
});
