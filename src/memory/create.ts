import { randomUUID } from "node:crypto";
import {
  CreateMemoryConfig,
  CreateMemoryShorthandConfig,
  LLMMessage,
  MemoryLayer,
  MongoMemoryConfig,
  PostgresMemoryConfig,
  RedisMemoryConfig,
  ToonDBMemoryConfig
} from "../types";
import { InMemoryLayer } from "../core/memory";

const DEFAULT_LIMIT = 10;

export function createMemory(config: CreateMemoryConfig | CreateMemoryShorthandConfig = {}): MemoryLayer {
  const resolved = normalizeConfig(config);

  if (resolved.provider === "memory") {
    return new InMemoryLayer(resolved.limit ?? DEFAULT_LIMIT);
  }

  if (resolved.provider === "postgresql") {
    return new PostgresMemoryLayer(resolved);
  }

  if (resolved.provider === "mongo") {
    return new MongoMemoryLayer(resolved);
  }

  if (resolved.provider === "redis") {
    return new RedisMemoryLayer(resolved);
  }

  if (resolved.provider === "toondb") {
    return new ToonDBMemoryLayer(resolved);
  }

  return new InMemoryLayer(resolved.limit ?? DEFAULT_LIMIT);
}

class PostgresMemoryLayer implements MemoryLayer {
  readonly provider = "postgresql" as const;
  private readonly config: PostgresMemoryConfig;
  private readonly limit: number;
  private client: {
    connect: () => Promise<void>;
    end: () => Promise<void>;
    query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  } | null = null;

  constructor(config: PostgresMemoryConfig) {
    this.config = config;
    this.limit = config.limit ?? DEFAULT_LIMIT;
  }

  async init(): Promise<void> {
    if (this.client) {
      return;
    }

    const pg = (await import("pg")) as unknown as {
      Client: new (args: { connectionString: string; ssl?: boolean | { rejectUnauthorized: boolean } }) => {
        connect: () => Promise<void>;
        end: () => Promise<void>;
        query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
      };
    };

    this.client = new pg.Client({
      connectionString: this.config.url,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined
    });
    await this.client.connect();

    const chatsTable = this.chatsTable();
    const messagesTable = this.messagesTable();
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${chatsTable} (
        chat_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${messagesTable} (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES ${chatsTable}(chat_id) ON DELETE CASCADE,
        message JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.client.query(`CREATE INDEX IF NOT EXISTS idx_${messagesTable}_chat_id_id ON ${messagesTable}(chat_id, id DESC)`);
  }

  async add(chatId: string, message: LLMMessage): Promise<void> {
    const client = this.mustClient();
    const chatsTable = this.chatsTable();
    const messagesTable = this.messagesTable();

    await client.query(
      `
      INSERT INTO ${chatsTable} (chat_id)
      VALUES ($1)
      ON CONFLICT (chat_id)
      DO UPDATE SET updated_at = NOW()
      `,
      [chatId]
    );

    await client.query(`INSERT INTO ${messagesTable} (chat_id, message) VALUES ($1, $2::jsonb)`, [chatId, JSON.stringify(message)]);

    await client.query(
      `
      DELETE FROM ${messagesTable}
      WHERE chat_id = $1
        AND id NOT IN (
          SELECT id FROM ${messagesTable}
          WHERE chat_id = $1
          ORDER BY id DESC
          LIMIT $2
        )
      `,
      [chatId, this.limit]
    );
  }

  async get(chatId: string): Promise<LLMMessage[]> {
    const client = this.mustClient();
    const messagesTable = this.messagesTable();

    const result = await client.query(
      `
      SELECT message FROM ${messagesTable}
      WHERE chat_id = $1
      ORDER BY id DESC
      LIMIT $2
      `,
      [chatId, this.limit]
    );

    return result.rows
      .map((row) => row.message as LLMMessage)
      .reverse();
  }

  async clear(chatId: string): Promise<void> {
    const client = this.mustClient();
    const chatsTable = this.chatsTable();
    await client.query(`DELETE FROM ${chatsTable} WHERE chat_id = $1`, [chatId]);
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.end();
    this.client = null;
  }

  private mustClient() {
    if (!this.client) {
      throw new Error("Memory not initialized. Call agent.start() or memory.init() first.");
    }
    return this.client;
  }

  private chatsTable(): string {
    const base = safeIdentifier(this.config.table ?? "telegram_agent_memory");
    return safeIdentifier(`${base}_chats`);
  }

  private messagesTable(): string {
    const base = safeIdentifier(this.config.table ?? "telegram_agent_memory");
    return safeIdentifier(`${base}_messages`);
  }
}

class MongoMemoryLayer implements MemoryLayer {
  readonly provider = "mongo" as const;
  private readonly config: MongoMemoryConfig;
  private readonly limit: number;
  private client: {
    connect: () => Promise<void>;
    close: () => Promise<void>;
      db: (name: string) => {
        collection: (name: string) => {
          createIndex: (index: Record<string, 1 | -1>, options?: Record<string, unknown>) => Promise<string>;
          insertOne: (doc: Record<string, unknown>) => Promise<unknown>;
          updateOne: (
            filter: Record<string, unknown>,
            update: Record<string, unknown>,
            options?: { upsert?: boolean }
          ) => Promise<unknown>;
          find: (filter: Record<string, unknown>) => {
            sort: (sort: Record<string, 1 | -1>) => {
              limit: (n: number) => { toArray: () => Promise<Array<Record<string, unknown>>> };
            skip: (n: number) => { project: (p: Record<string, number>) => { toArray: () => Promise<Array<Record<string, unknown>>> } };
          };
        };
        deleteMany: (filter: Record<string, unknown>) => Promise<unknown>;
      };
    };
  } | null = null;

  constructor(config: MongoMemoryConfig) {
    this.config = config;
    this.limit = config.limit ?? DEFAULT_LIMIT;
  }

  async init(): Promise<void> {
    if (this.client) {
      return;
    }

    const mongo = (await import("mongodb")) as unknown as {
      MongoClient: new (uri: string) => {
        connect: () => Promise<void>;
        close: () => Promise<void>;
        db: (name: string) => {
          collection: (name: string) => {
            createIndex: (index: Record<string, 1 | -1>, options?: Record<string, unknown>) => Promise<string>;
            insertOne: (doc: Record<string, unknown>) => Promise<unknown>;
            updateOne: (
              filter: Record<string, unknown>,
              update: Record<string, unknown>,
              options?: { upsert?: boolean }
            ) => Promise<unknown>;
            find: (filter: Record<string, unknown>) => {
              sort: (sort: Record<string, 1 | -1>) => {
                limit: (n: number) => { toArray: () => Promise<Array<Record<string, unknown>>> };
                skip: (n: number) => { project: (p: Record<string, number>) => { toArray: () => Promise<Array<Record<string, unknown>>> } };
              };
            };
            deleteMany: (filter: Record<string, unknown>) => Promise<unknown>;
          };
        };
      };
    };

    this.client = new mongo.MongoClient(this.config.url);
    await this.client.connect();

    await this.chatsCollection().createIndex({ chatId: 1 }, { unique: true });
    await this.messagesCollection().createIndex({ chatId: 1, createdAt: -1 });
  }

  async add(chatId: string, message: LLMMessage): Promise<void> {
    const chats = this.chatsCollection();
    const messages = this.messagesCollection();
    const now = new Date();

    await chats.updateOne(
      { chatId },
      {
        $setOnInsert: { chatId, createdAt: now },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );

    await messages.insertOne({
      chatId,
      message,
      createdAt: now
    });

    const overflow = await messages
      .find({ chatId })
      .sort({ createdAt: -1, _id: -1 })
      .skip(this.limit)
      .project({ _id: 1 })
      .toArray();

    if (overflow.length > 0) {
      await messages.deleteMany({ _id: { $in: overflow.map((x) => x._id) } });
    }
  }

  async get(chatId: string): Promise<LLMMessage[]> {
    const messages = this.messagesCollection();

    const docs = await messages
      .find({ chatId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(this.limit)
      .toArray();

    return docs
      .map((doc) => doc.message as LLMMessage)
      .reverse();
  }

  async clear(chatId: string): Promise<void> {
    await this.messagesCollection().deleteMany({ chatId });
    await this.chatsCollection().deleteMany({ chatId });
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;
  }

  private chatsCollection() {
    if (!this.client) {
      throw new Error("Memory not initialized. Call agent.start() or memory.init() first.");
    }
    const base = this.config.collection ?? "memory";
    return this.client
      .db(this.config.dbName ?? "telegram_agent_sdk")
      .collection(`${base}_chats`);
  }

  private messagesCollection() {
    if (!this.client) {
      throw new Error("Memory not initialized. Call agent.start() or memory.init() first.");
    }
    const base = this.config.collection ?? "memory";
    return this.client
      .db(this.config.dbName ?? "telegram_agent_sdk")
      .collection(`${base}_messages`);
  }
}

class RedisMemoryLayer implements MemoryLayer {
  readonly provider = "redis" as const;
  private readonly config: RedisMemoryConfig;
  private readonly limit: number;
  private client: {
    connect: () => Promise<void>;
    quit: () => Promise<void>;
    sAdd: (key: string, member: string) => Promise<unknown>;
    sRem: (key: string, member: string) => Promise<unknown>;
    hSet: (key: string, values: Record<string, string>) => Promise<unknown>;
    rPush: (key: string, value: string) => Promise<unknown>;
    lTrim: (key: string, start: number, stop: number) => Promise<unknown>;
    lRange: (key: string, start: number, stop: number) => Promise<string[]>;
    del: (key: string) => Promise<unknown>;
  } | null = null;

  constructor(config: RedisMemoryConfig) {
    this.config = config;
    this.limit = config.limit ?? DEFAULT_LIMIT;
  }

  async init(): Promise<void> {
    if (this.client) {
      return;
    }

    const redis = (await import("redis")) as unknown as {
      createClient: (options: { url: string }) => {
        connect: () => Promise<void>;
        quit: () => Promise<void>;
        sAdd: (key: string, member: string) => Promise<unknown>;
        sRem: (key: string, member: string) => Promise<unknown>;
        hSet: (key: string, values: Record<string, string>) => Promise<unknown>;
        rPush: (key: string, value: string) => Promise<unknown>;
        lTrim: (key: string, start: number, stop: number) => Promise<unknown>;
        lRange: (key: string, start: number, stop: number) => Promise<string[]>;
        del: (key: string) => Promise<unknown>;
      };
    };

    this.client = redis.createClient({ url: this.config.url });
    await this.client.connect();
  }

  async add(chatId: string, message: LLMMessage): Promise<void> {
    const client = this.mustClient();
    const now = new Date().toISOString();

    await client.sAdd(this.chatsIndexKey(), chatId);
    await client.hSet(this.chatKey(chatId), {
      chatId,
      updatedAt: now,
      createdAt: now
    });

    await client.rPush(this.messagesKey(chatId), JSON.stringify(message));
    await client.lTrim(this.messagesKey(chatId), -this.limit, -1);
  }

  async get(chatId: string): Promise<LLMMessage[]> {
    const client = this.mustClient();
    const rows = await client.lRange(this.messagesKey(chatId), 0, -1);

    return rows
      .map((row) => {
        try {
          return JSON.parse(row) as LLMMessage;
        } catch {
          return null;
        }
      })
      .filter((x): x is LLMMessage => Boolean(x));
  }

  async clear(chatId: string): Promise<void> {
    const client = this.mustClient();
    await client.del(this.messagesKey(chatId));
    await client.del(this.chatKey(chatId));
    await client.sRem(this.chatsIndexKey(), chatId);
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.quit();
    this.client = null;
  }

  private chatsIndexKey(): string {
    return `${this.config.keyPrefix ?? "tg_agent_memory"}:chats`;
  }

  private chatKey(chatId: string): string {
    return `${this.config.keyPrefix ?? "tg_agent_memory"}:chat:${chatId}`;
  }

  private messagesKey(chatId: string): string {
    return `${this.config.keyPrefix ?? "tg_agent_memory"}:messages:${chatId}`;
  }

  private mustClient() {
    if (!this.client) {
      throw new Error("Memory not initialized. Call agent.start() or memory.init() first.");
    }
    return this.client;
  }
}

class ToonDBMemoryLayer implements MemoryLayer {
  readonly provider = "toondb" as const;
  private readonly config: ToonDBMemoryConfig;
  private readonly limit: number;
  private client: {
    createCollection: (collection: string, schema: Record<string, unknown>) => Promise<unknown>;
    insert: (collection: string, doc: Record<string, unknown>) => Promise<unknown>;
    update: (
      collection: string,
      filter: { conditions: Array<Record<string, unknown>> },
      patch: Record<string, unknown>
    ) => Promise<unknown>;
    find: (collection: string, filter: { conditions: Array<Record<string, unknown>> }) => Promise<Array<Record<string, unknown>>>;
    delete: (collection: string, filter: { conditions: Array<Record<string, unknown>> }) => Promise<unknown>;
  } | null = null;

  constructor(config: ToonDBMemoryConfig) {
    this.config = config;
    this.limit = config.limit ?? DEFAULT_LIMIT;
  }

  async init(): Promise<void> {
    if (this.client) {
      return;
    }

    const toondb = (await import("toondb")) as unknown as {
      ToonDBClient: new (args: { baseUrl: string; username: string; password: string }) => {
        createCollection: (collection: string, schema: Record<string, unknown>) => Promise<unknown>;
        insert: (collection: string, doc: Record<string, unknown>) => Promise<unknown>;
        update: (
          collection: string,
          filter: { conditions: Array<Record<string, unknown>> },
          patch: Record<string, unknown>
        ) => Promise<unknown>;
        find: (collection: string, filter: { conditions: Array<Record<string, unknown>> }) => Promise<Array<Record<string, unknown>>>;
        delete: (collection: string, filter: { conditions: Array<Record<string, unknown>> }) => Promise<unknown>;
      };
    };

    this.client = new toondb.ToonDBClient({
      baseUrl: this.config.url,
      username: this.config.username,
      password: this.config.password
    });

    const chatsCollection = this.chatsCollection();
    const messagesCollection = this.messagesCollection();
    try {
      await this.client.createCollection(chatsCollection, {
        fields: {
          id: "string",
          chatId: "string",
          createdAt: "number",
          updatedAt: "number"
        },
        indexed_fields: ["chatId", "id", "updatedAt"]
      });
    } catch {
      // collection may already exist
    }

    try {
      await this.client.createCollection(messagesCollection, {
        fields: {
          messageId: "string",
          chatId: "string",
          ts: "number",
          message: "json"
        },
        indexed_fields: ["chatId", "messageId", "ts"]
      });
    } catch {
      // collection may already exist
    }
  }

  async add(chatId: string, message: LLMMessage): Promise<void> {
    const client = this.mustClient();
    const chatsCollection = this.chatsCollection();
    const messagesCollection = this.messagesCollection();
    const now = Date.now();

    const chats = await client.find(chatsCollection, {
      conditions: [{ field: "chatId", op: "eq", value: chatId }]
    });

    if (chats.length === 0) {
      await client.insert(chatsCollection, {
        id: randomUUID(),
        chatId,
        createdAt: now,
        updatedAt: now
      });
    } else {
      await client.update(
        chatsCollection,
        { conditions: [{ field: "chatId", op: "eq", value: chatId }] },
        { updatedAt: now }
      );
    }

    await client.insert(messagesCollection, {
      messageId: randomUUID(),
      chatId,
      ts: now,
      message
    });

    const all = await this.fetchAll(chatId);
    if (all.length > this.limit) {
      const overflow = all.slice(0, all.length - this.limit);
      for (const doc of overflow) {
        if (typeof doc.messageId !== "string") {
          continue;
        }
        await client.delete(messagesCollection, {
          conditions: [{ field: "messageId", op: "eq", value: doc.messageId }]
        });
      }
    }
  }

  async get(chatId: string): Promise<LLMMessage[]> {
    const all = await this.fetchAll(chatId);
    return all
      .slice(Math.max(0, all.length - this.limit))
      .map((doc) => doc.message)
      .filter((x): x is LLMMessage => Boolean(x));
  }

  async clear(chatId: string): Promise<void> {
    const client = this.mustClient();
    await client.delete(this.messagesCollection(), {
      conditions: [{ field: "chatId", op: "eq", value: chatId }]
    });
    await client.delete(this.chatsCollection(), {
      conditions: [{ field: "chatId", op: "eq", value: chatId }]
    });
  }

  async close(): Promise<void> {
    return;
  }

  private async fetchAll(chatId: string): Promise<Array<{ messageId?: string; ts: number; message?: LLMMessage }>> {
    const client = this.mustClient();
    const rows = await client.find(this.messagesCollection(), {
      conditions: [{ field: "chatId", op: "eq", value: chatId }]
    });

    return rows
      .map((row) => ({
        messageId: typeof row.messageId === "string" ? row.messageId : undefined,
        ts: typeof row.ts === "number" ? row.ts : 0,
        message: row.message as LLMMessage | undefined
      }))
      .sort((a, b) => a.ts - b.ts);
  }

  private chatsCollection(): string {
    const base = this.config.collection ?? "telegram_agent_memory";
    return `${base}_chats`;
  }

  private messagesCollection(): string {
    const base = this.config.collection ?? "telegram_agent_memory";
    return `${base}_messages`;
  }

  private mustClient() {
    if (!this.client) {
      throw new Error("Memory not initialized. Call agent.start() or memory.init() first.");
    }
    return this.client;
  }
}

function safeIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL table identifier: ${name}`);
  }
  return name;
}

function normalizeConfig(config: CreateMemoryConfig | CreateMemoryShorthandConfig): CreateMemoryConfig {
  if ("provider" in config || Object.keys(config).length === 0) {
    const direct = config as CreateMemoryConfig;
    if (direct.provider) {
      return direct;
    }
    return { provider: "memory", limit: direct.limit };
  }

  const shorthand = config as CreateMemoryShorthandConfig;

  if (shorthand.postgresql) {
    return {
      provider: "postgresql",
      ...shorthand.postgresql
    };
  }

  if (shorthand.mongo) {
    return {
      provider: "mongo",
      ...shorthand.mongo
    };
  }

  if (shorthand.redis) {
    return {
      provider: "redis",
      ...shorthand.redis
    };
  }

  if (shorthand.toondb) {
    return {
      provider: "toondb",
      ...shorthand.toondb
    };
  }

  return {
    provider: "memory",
    ...(shorthand.memory ?? {})
  };
}
