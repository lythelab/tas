export type Provider = "openai" | "anthropic" | "qwen";

export type Tool = {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

export type LLMRole = "system" | "user" | "assistant" | "tool";

export type LLMToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type LLMMessage = {
  role: LLMRole;
  content: string;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
  name?: string;
};

export type LLMResponse = {
  text: string;
  toolCalls: LLMToolCall[];
  raw?: unknown;
};

export type LLMCompletionParams = {
  model: string;
  messages: LLMMessage[];
  tools: Tool[];
};

export type LLMAdapter = {
  complete: (params: LLMCompletionParams) => Promise<LLMResponse>;
};

export type WebhookConfig = {
  url?: string;
  path?: string;
  port?: number;
  external?: boolean;
  secretToken?: string;
  autoRegister?: boolean;
};

export type DevConfig = {
  port?: number;
  host?: string;
  logLevel?: "basic" | "verbose";
};

export type OpenAIModel =
  | "gpt-5.1"
  | "gpt-5"
  | "gpt-5-pro"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "gpt-4.1";

export type AnthropicModel =
  | "claude-opus-4-20250514"
  | "claude-sonnet-4-20250514"
  | "claude-3-7-sonnet-latest"
  | "claude-3-5-haiku-latest";

export type QwenModel =
  | "qwen-max"
  | "qwen-plus"
  | "qwen-turbo"
  | "qwen3-coder-plus";

export type KnownModel = OpenAIModel | AnthropicModel | QwenModel;

type LLMConfigBase = {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
};

export type OpenAILLMConfig = LLMConfigBase & {
  provider: "openai";
  model?: OpenAIModel | (string & {});
};

export type AnthropicLLMConfig = LLMConfigBase & {
  provider: "anthropic";
  model?: AnthropicModel | (string & {});
};

export type QwenLLMConfig = LLMConfigBase & {
  provider: "qwen";
  model?: QwenModel | (string & {});
};

export type AutoProviderLLMConfig = LLMConfigBase & {
  provider?: undefined;
  model?: KnownModel | (string & {});
};

export type LLMConfig = OpenAILLMConfig | AnthropicLLMConfig | QwenLLMConfig | AutoProviderLLMConfig;

export type TypingConfig = {
  enabled?: boolean;
  intervalMs?: number;
};

export type AgentOptions = {
  token: string;
  model?: KnownModel | (string & {});
  tools?: Tool[];
  systemPrompt?: string;
  webhook?: WebhookConfig;
  isDev?: boolean;
  dev?: DevConfig;
  llm?: LLMConfig;
  memoryLimit?: number;
  memory?: MemoryLayer;
  typing?: boolean | TypingConfig;
};

export type ModelSuggestion = {
  id: string;
  label: string;
  tier: "flagship" | "balanced" | "fast" | "reasoning";
  contextWindow?: number;
  recommended?: boolean;
};

export type ModelCatalog = Record<Provider, ModelSuggestion[]>;

export type MemoryProvider = "memory" | "postgresql" | "mongo" | "redis" | "toondb";

export type MemoryLayer = {
  provider: MemoryProvider;
  init: () => Promise<void>;
  add: (chatId: string, message: LLMMessage) => Promise<void>;
  get: (chatId: string) => Promise<LLMMessage[]>;
  clear: (chatId: string) => Promise<void>;
  close: () => Promise<void>;
};

export type MemoryBaseConfig = {
  limit?: number;
};

export type InMemoryConfig = MemoryBaseConfig & {
  provider?: "memory";
};

export type PostgresMemoryConfig = MemoryBaseConfig & {
  provider: "postgresql";
  url: string;
  table?: string;
  ssl?: boolean;
};

export type MongoMemoryConfig = MemoryBaseConfig & {
  provider: "mongo";
  url: string;
  dbName?: string;
  collection?: string;
};

export type RedisMemoryConfig = MemoryBaseConfig & {
  provider: "redis";
  url: string;
  keyPrefix?: string;
};

export type ToonDBMemoryConfig = MemoryBaseConfig & {
  provider: "toondb";
  url: string;
  username: string;
  password: string;
  collection?: string;
};

export type CreateMemoryConfig =
  | InMemoryConfig
  | PostgresMemoryConfig
  | MongoMemoryConfig
  | RedisMemoryConfig
  | ToonDBMemoryConfig;

export type CreateMemoryShorthandConfig = {
  memory?: InMemoryConfig;
  postgresql?: Omit<PostgresMemoryConfig, "provider">;
  mongo?: Omit<MongoMemoryConfig, "provider">;
  redis?: Omit<RedisMemoryConfig, "provider">;
  toondb?: Omit<ToonDBMemoryConfig, "provider">;
};

export type AgentEventName =
  | "message_received"
  | "llm_called"
  | "tool_called"
  | "response_sent"
  | "runtime_error";

export type AgentEvent = {
  id: string;
  ts: number;
  event: AgentEventName;
  chatId?: string;
  payload: Record<string, unknown>;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: {
      id: number;
      type: string;
    };
  };
};

export type TelegramWebhookHandler = (body: unknown, headers?: Record<string, string | string[] | undefined>) => Promise<void>;
