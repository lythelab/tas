import { describe, expect, it } from "vitest";
import { InMemoryLayer } from "../src/core/memory";

describe("InMemoryLayer", () => {
  it("keeps only last N messages", async () => {
    const store = new InMemoryLayer(2);
    await store.init();

    await store.add("1", { role: "user", content: "a" });
    await store.add("1", { role: "assistant", content: "b" });
    await store.add("1", { role: "user", content: "c" });

    const messages = await store.get("1");
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("b");
    expect(messages[1].content).toBe("c");
  });
});
