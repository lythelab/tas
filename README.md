# telegram-agent-sdk

Build Telegram AI agents fast with one SDK: webhook runtime, LLM routing, tool calling, memory layers, and dev observability.

## What Is It?

`telegram-agent-sdk` is a Node.js SDK that helps you ship Telegram agents with minimal setup.

You get:
- Telegram webhook runtime
- OpenAI, Anthropic, and Qwen support
- Function tool calling
- Memory layers (in-memory, PostgreSQL, MongoDB, Redis, ToonDB)
- Dev dashboard + runtime events
- Typing indicator support

## Installation

```bash
npm install telegram-agent-sdk
```

Package:
- https://www.npmjs.com/package/telegram-agent-sdk

## 5-Minute Quick Start

```js
// index.js
require("dotenv").config();
const { createTelegramAgent, createMemory } = require("telegram-agent-sdk");

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN,
  llm: {
    provider: "qwen",
    model: "qwen-plus",
    apiKey: process.env.QWEN_API_KEY
  },
  tools: [
    {
      name: "ping",
      description: "health check",
      execute: async () => ({ pong: true, at: new Date().toISOString() })
    }
  ],
  memory: createMemory({ provider: "memory", limit: 20 }),
  webhook: { port: 3000, path: "/webhook" },
  dev: { port: 5173, host: "127.0.0.1" },
  typing: true,
  isDev: true
});

agent.start().catch(console.error);
```

Dashboard URL in dev mode:
- `http://127.0.0.1:5173`

## Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN`

Provider keys (pick one):
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`)

Optional memory backends:
- `POSTGRESQL_URL`
- `MONGODB_URL`
- `REDIS_URL`
- `TOONDB_URL`, `TOONDB_USER`, `TOONDB_PASS`

## Model Suggestions (IntelliSense Friendly)

```js
const { getSuggestedModels } = require("telegram-agent-sdk");

console.log(getSuggestedModels("openai"));
console.log(getSuggestedModels("anthropic"));
console.log(getSuggestedModels("qwen"));
```

In JS, use JSDoc types to get provider-specific model autocomplete:

```js
// @ts-check
/** @type {import("telegram-agent-sdk").QwenLLMConfig} */
const llm = {
  provider: "qwen",
  model: "qwen-plus"
};
```

## Memory Layer

Attach memory to agent:

```js
const { createMemory } = require("telegram-agent-sdk");

const memory = createMemory({
  postgresql: {
    url: process.env.POSTGRESQL_URL,
    limit: 50
  }
});
```

Supported:
- `memory`
- `postgresql`
- `mongo`
- `redis`
- `toondb`

## Examples

See runnable JS examples in [`examples/`](./examples):
- [`basic-agent.js`](./examples/basic-agent.js)
- [`customer-support-agent.js`](./examples/customer-support-agent.js)
- [`ecommerce-assistant-agent.js`](./examples/ecommerce-assistant-agent.js)

## Docs

Start here: [`docs/README.md`](./docs/README.md)
Read more in the docs folder for step-by-step guides and advanced setup.

Hosted docs:
- https://tas.lythe.ai/docs

npm package:
- https://www.npmjs.com/package/telegram-agent-sdk

Detailed guides:
- [Quickstart](./docs/quickstart.md)
- [Provider Configuration](./docs/providers.md)
- [Model Suggestions](./docs/models.md)
- [Memory Configuration](./docs/memory.md)
- [Webhook Deployment](./docs/webhooks.md)
- [Dashboard](./docs/dashboard.md)
- [Testing Guide](./docs/testing.md)

## API Surface

Main exports:
- `createTelegramAgent(...)`
- `createMemory(...)`
- `getSuggestedModels(provider?)`
- `getModelCatalog()`
- `updateModelCatalog(partial)`
- `updateModelCatalogFromUrl(url)`

## Development

```bash
npm install
npm run build
npm test
```

## Notes

Qwen uses OpenAI-compatible mode via Alibaba Model Studio-compatible endpoint.
Reference: https://www.alibabacloud.com/help/doc-detail/2999751.html

ToonDB project reference:
- https://github.com/lythelab/toondb
