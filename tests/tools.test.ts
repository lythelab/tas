import { describe, expect, it } from "vitest";
import { ToolExecutor } from "../src/tools/executor";

describe("ToolExecutor", () => {
  it("executes tool with parsed JSON args", async () => {
    const tools = new ToolExecutor([
      {
        name: "sum",
        description: "sum numbers",
        execute: ({ a, b }) => Number(a) + Number(b)
      }
    ]);

    const value = await tools.execute("sum", "{\"a\":2,\"b\":5}");
    expect(value).toBe(7);
  });

  it("throws for invalid JSON", async () => {
    const tools = new ToolExecutor([
      {
        name: "noop",
        description: "noop",
        execute: () => "ok"
      }
    ]);

    await expect(tools.execute("noop", "{"))
      .rejects
      .toThrow("Invalid JSON arguments");
  });
});
