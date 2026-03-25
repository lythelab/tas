import { describe, expect, it, vi } from "vitest";
import { createTelegramAgent } from "../src";
import type { MemoryLayer } from "../src/types";

describe("Agent memory lifecycle", () => {
  it("initializes custom memory before processing update", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const memory: MemoryLayer = {
      provider: "memory",
      init: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const agent = createTelegramAgent({
      token: "telegram-token",
      webhook: { external: true },
      memory
    });

    await agent.processUpdate({ update_id: 1 });

    expect(memory.init).toHaveBeenCalledTimes(1);
  });
});
