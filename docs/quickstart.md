# Quickstart

## 1. Install

```bash
npm install telegram-agent-sdk
```

Links:
- Docs: https://tas.lythe.ai/docs
- npm: https://www.npmjs.com/package/telegram-agent-sdk

## 2. Set environment variables

```bash
# required
export TELEGRAM_BOT_TOKEN=...

# choose one provider key
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export QWEN_API_KEY=...
```

## 3. Run a minimal agent

```ts
import { createMemory, createTelegramAgent } from "telegram-agent-sdk";

const memory = createMemory({
  provider: "memory",
  limit: 20
});

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  llm: { provider: "openai", model: "gpt-5-mini" },
  memory,
  dev: { port: 5173, host: "127.0.0.1" },
  isDev: true
});

await agent.start();
```

Dev dashboard:
- `http://127.0.0.1:5173`

## 4. Set Telegram webhook

Either:

- configure `webhook.url` and `autoRegister: true`, or
- call Telegram `setWebhook` manually to point to your `/webhook` path.

