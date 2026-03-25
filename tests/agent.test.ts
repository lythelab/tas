import { describe, expect, it } from "vitest";
import { createTelegramAgent } from "../src";

describe("createTelegramAgent", () => {
  it("validates webhook secret token", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const agent = createTelegramAgent({
      token: "telegram-token",
      webhook: {
        external: true,
        secretToken: "abc"
      }
    });

    await expect(
      agent.processUpdate(
        { update_id: 1 },
        { "x-telegram-bot-api-secret-token": "wrong" }
      )
    ).rejects.toThrow("Invalid webhook secret token");
  });
});
