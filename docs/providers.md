# Provider Configuration

## OpenAI

```ts
llm: {
  provider: "openai",
  model: "gpt-5-mini",
  apiKey: process.env.OPENAI_API_KEY
}
```

## Anthropic

```ts
llm: {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKey: process.env.ANTHROPIC_API_KEY
}
```

## Qwen

```ts
llm: {
  provider: "qwen",
  model: "qwen-plus",
  apiKey: process.env.QWEN_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
}
```

Qwen uses an OpenAI-compatible Chat Completions interface in Model Studio.
