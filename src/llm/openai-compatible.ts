import { LLMAdapter, LLMCompletionParams, LLMMessage, LLMResponse, Tool } from "../types";

type OpenAIChatCompletionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAIConfig = {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
};

export class OpenAICompatibleAdapter implements LLMAdapter {
  private readonly config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async complete(params: LLMCompletionParams): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: mapMessages(params.messages),
      temperature: this.config.temperature ?? 0.2
    };

    if (typeof this.config.maxTokens === "number") {
      body.max_tokens = this.config.maxTokens;
    }

    if (params.tools.length > 0) {
      body.tools = mapTools(params.tools);
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.headers ?? {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI-compatible request failed (${response.status}): ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = json.choices?.[0]?.message;
    const toolCalls =
      message?.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments
      })) ?? [];

    return {
      text: message?.content ?? "",
      toolCalls,
      raw: json
    };
  }
}

function mapTools(tools: Tool[]): OpenAIChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: true
      }
    }
  }));
}

function mapMessages(messages: LLMMessage[]): Array<Record<string, unknown>> {
  const mapped: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      mapped.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: call.arguments
          }
        }))
      });
      continue;
    }

    if (message.role === "tool") {
      mapped.push({
        role: "tool",
        tool_call_id: message.toolCallId,
        content: message.content
      });
      continue;
    }

    mapped.push({
      role: message.role,
      content: message.content
    });
  }

  return mapped;
}
