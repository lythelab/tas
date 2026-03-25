import { AnthropicAdapter } from "./anthropic";
import { OpenAICompatibleAdapter } from "./openai-compatible";
import { AgentOptions, LLMAdapter, Provider } from "../types";
import { getDefaultModel } from "./models";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export function createLLMAdapter(options: AgentOptions): { adapter: LLMAdapter; model: string; provider: Provider } {
  const provider = resolveProvider(options);
  const model = options.llm?.model ?? options.model ?? getDefaultModel(provider);

  if (provider === "anthropic") {
    const apiKey = options.llm?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY (or llm.apiKey)");
    }

    return {
      provider,
      model,
      adapter: new AnthropicAdapter({
        apiKey,
        baseURL: options.llm?.baseURL ?? ANTHROPIC_BASE_URL,
        headers: options.llm?.headers,
        maxTokens: options.llm?.maxTokens,
        temperature: options.llm?.temperature
      })
    };
  }

  if (provider === "qwen") {
    const apiKey = options.llm?.apiKey ?? process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing QWEN_API_KEY (or DASHSCOPE_API_KEY / llm.apiKey)");
    }

    return {
      provider,
      model,
      adapter: new OpenAICompatibleAdapter({
        apiKey,
        baseURL: options.llm?.baseURL ?? QWEN_BASE_URL,
        headers: options.llm?.headers,
        maxTokens: options.llm?.maxTokens,
        temperature: options.llm?.temperature
      })
    };
  }

  const apiKey = options.llm?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (or llm.apiKey)");
  }

  return {
    provider,
    model,
    adapter: new OpenAICompatibleAdapter({
      apiKey,
      baseURL: options.llm?.baseURL ?? OPENAI_BASE_URL,
      headers: options.llm?.headers,
      maxTokens: options.llm?.maxTokens,
      temperature: options.llm?.temperature
    })
  };
}

function resolveProvider(options: AgentOptions): Provider {
  if (options.llm?.provider) {
    return options.llm.provider;
  }

  const model = (options.llm?.model ?? options.model ?? "").toLowerCase();
  if (model.startsWith("claude")) {
    return "anthropic";
  }
  if (model.startsWith("qwen")) {
    return "qwen";
  }

  return "openai";
}
