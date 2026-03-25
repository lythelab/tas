import { describe, expect, it } from "vitest";
import { getSuggestedModels, updateModelCatalog } from "../src";

describe("model suggestions", () => {
  it("returns non-empty suggestions for each provider", () => {
    expect(getSuggestedModels("openai").length).toBeGreaterThan(0);
    expect(getSuggestedModels("anthropic").length).toBeGreaterThan(0);
    expect(getSuggestedModels("qwen").length).toBeGreaterThan(0);
  });

  it("allows catalog updates", () => {
    const updated = updateModelCatalog({
      openai: [{ id: "gpt-test", label: "GPT Test", tier: "fast", recommended: true }]
    });

    expect(updated.openai[0].id).toBe("gpt-test");
  });
});
