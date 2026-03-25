import { LLMAdapter, LLMCompletionParams, LLMMessage, LLMResponse, Tool } from "../types";

type AnthropicConfig = {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  maxTokens?: number;
  temperature?: number;
};

export class AnthropicAdapter implements LLMAdapter {
  private readonly config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
  }

  async complete(params: LLMCompletionParams): Promise<LLMResponse> {
    const { system, messages } = mapMessages(params.messages);

    const body: Record<string, unknown> = {
      model: params.model,
      system,
      messages,
      max_tokens: this.config.maxTokens ?? 1024,
      temperature: this.config.temperature ?? 0.2
    };

    if (params.tools.length > 0) {
      body.tools = mapTools(params.tools);
    }

    const response = await fetch(`${this.config.baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        ...(this.config.headers ?? {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${text}`);
    }

    const json = (await response.json()) as {
      content?: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
    };

    const text =
      json.content
        ?.filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("\n") ?? "";

    const toolCalls =
      json.content
        ?.filter((block) => block.type === "tool_use")
        .map((block) => {
          const tool = block as {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
          };
          return {
            id: tool.id,
            name: tool.name,
            arguments: JSON.stringify(tool.input ?? {})
          };
        }) ?? [];

    return {
      text,
      toolCalls,
      raw: json
    };
  }
}

function mapTools(tools: Tool[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: true
    }
  }));
}

function mapMessages(messages: LLMMessage[]): {
  system: string;
  messages: Array<Record<string, unknown>>;
} {
  let system = "";
  const out: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === "system") {
      system = [system, message.content].filter(Boolean).join("\n");
      continue;
    }

    if (message.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: message.content
          }
        ]
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (message.content) {
        content.push({ type: "text", text: message.content });
      }

      for (const call of message.toolCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          input = {};
        }
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input
        });
      }

      out.push({ role: "assistant", content });
      continue;
    }

    if (message.role === "assistant") {
      out.push({ role: "assistant", content: message.content });
      continue;
    }

    out.push({ role: "user", content: message.content });
  }

  return { system, messages: out };
}
