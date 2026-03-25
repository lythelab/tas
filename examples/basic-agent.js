require("dotenv").config();
const { createTelegramAgent, createMemory } = require("tas");

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN,
  llm: {
    provider: process.env.LLM_PROVIDER || "qwen",
    model: process.env.LLM_MODEL || "qwen-plus",
    apiKey:
      process.env.QWEN_API_KEY ||
      process.env.DASHSCOPE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY
  },
  systemPrompt: "You are a concise and helpful Telegram assistant.",
  tools: [
    {
      name: "ping",
      description: "Health check",
      execute: async () => ({ pong: true, at: new Date().toISOString() })
    },
    {
      name: "get_time",
      description: "Get current time in a timezone",
      execute: async ({ timezone = "Asia/Kolkata" }) => ({
        timezone,
        time: new Date().toLocaleString("en-IN", { timeZone: timezone })
      })
    },
    {
      name: "add",
      description: "Add two numbers",
      execute: async ({ a = 0, b = 0 }) => ({ result: Number(a) + Number(b) })
    }
  ],
  memory: createMemory({ provider: "memory", limit: 20 }),
  webhook: { port: 3000, path: "/webhook", autoRegister: false },
  typing: true,
  isDev: true
});

agent.start().then(() => {
  console.log("basic-agent running on http://localhost:3000/webhook");
}).catch(console.error);
