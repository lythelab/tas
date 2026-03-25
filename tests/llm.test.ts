import { afterEach, describe, expect, it } from "vitest";
import { createLLMAdapter } from "../src/llm";

const oldEnv = { ...process.env };

afterEach(() => {
  process.env = { ...oldEnv };
});

describe("LLM adapter selection", () => {
  it("selects anthropic from model prefix", () => {
    process.env.ANTHROPIC_API_KEY = "x";
    const selected = createLLMAdapter({ token: "t", model: "claude-3-5-sonnet" });
    expect(selected.provider).toBe("anthropic");
  });

  it("selects qwen from explicit provider", () => {
    process.env.QWEN_API_KEY = "x";
    const selected = createLLMAdapter({ token: "t", llm: { provider: "qwen", model: "qwen-plus" } });
    expect(selected.provider).toBe("qwen");
  });
});
