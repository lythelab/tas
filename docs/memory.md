# Memory Configuration

Use `createMemory(...)` and pass the result into `createTelegramAgent({ memory })`.

All persistent providers now store memory in a parent-chat + child-messages shape:

- parent: `chats`
- child: `messages`

## Basic pattern

```ts
import { createMemory, createTelegramAgent } from "telegram-agent-sdk";

const memory = createMemory({
  postgresql: {
    url: process.env.POSTGRES_URL!,
    limit: 20
  }
});

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN!,
  llm: { provider: "openai", model: "gpt-5-mini" },
  memory
});
```

## Supported providers

### In-memory

```ts
createMemory({ provider: "memory", limit: 10 });
```

### PostgreSQL

```ts
createMemory({
  provider: "postgresql",
  url: process.env.POSTGRES_URL!,
  table: "telegram_agent_memory",
  limit: 30
});
```

Storage tables:

- `${table || "telegram_agent_memory"}_chats`
- `${table || "telegram_agent_memory"}_messages`

### MongoDB

```ts
createMemory({
  provider: "mongo",
  url: process.env.MONGODB_URL!,
  dbName: "telegram_agent_sdk",
  collection: "memory",
  limit: 30
});
```

Storage collections:

- `${collection || "memory"}_chats`
- `${collection || "memory"}_messages`

### Redis

```ts
createMemory({
  provider: "redis",
  url: process.env.REDIS_URL!,
  keyPrefix: "tg_agent",
  limit: 30
});
```

Storage keys:

- `${keyPrefix}:chats` (chat index set)
- `${keyPrefix}:chat:<chatId>` (chat metadata hash)
- `${keyPrefix}:messages:<chatId>` (message list)

### ToonDB

```ts
createMemory({
  provider: "toondb",
  url: process.env.TOONDB_URL!,
  username: process.env.TOONDB_USER!,
  password: process.env.TOONDB_PASS!,
  collection: "telegram_agent_memory",
  limit: 30
});
```

Storage collections:

- `${collection || "telegram_agent_memory"}_chats`
- `${collection || "telegram_agent_memory"}_messages`

## Shorthand syntax

```ts
createMemory({
  postgresql: {
    url: "postgres://localhost:5432/mydb"
  }
});
```

