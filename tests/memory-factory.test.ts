import { describe, expect, it } from "vitest";
import { createMemory } from "../src";

describe("createMemory", () => {
  it("supports provider config", async () => {
    const memory = createMemory({ provider: "memory", limit: 2 });
    await memory.init();

    await memory.add("1", { role: "user", content: "a" });
    await memory.add("1", { role: "assistant", content: "b" });
    await memory.add("1", { role: "user", content: "c" });

    const messages = await memory.get("1");
    expect(messages.map((m) => m.content)).toEqual(["b", "c"]);
  });

  it("supports shorthand config", () => {
    const memory = createMemory({
      postgresql: {
        url: "postgres://localhost:5432/x"
      }
    });

    expect(memory.provider).toBe("postgresql");
  });
});
