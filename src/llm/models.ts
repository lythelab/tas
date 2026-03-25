import { ModelCatalog, ModelSuggestion, Provider } from "../types";

const DEFAULT_CATALOG: ModelCatalog = {
  openai: [
    { id: "gpt-5.1", label: "GPT-5.1", tier: "flagship", recommended: true },
    { id: "gpt-5", label: "GPT-5", tier: "reasoning" },
    { id: "gpt-5-pro", label: "GPT-5 Pro", tier: "reasoning" },
    { id: "gpt-5-mini", label: "GPT-5 mini", tier: "balanced" },
    { id: "gpt-5-nano", label: "GPT-5 nano", tier: "fast" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "balanced" }
  ],
  anthropic: [
    { id: "claude-opus-4-20250514", label: "Claude Opus 4", tier: "flagship", recommended: true },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", tier: "balanced" },
    { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet", tier: "reasoning" },
    { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", tier: "fast" }
  ],
  qwen: [
    { id: "qwen-max", label: "Qwen Max", tier: "flagship", recommended: true },
    { id: "qwen-plus", label: "Qwen Plus", tier: "balanced" },
    { id: "qwen-turbo", label: "Qwen Turbo", tier: "fast" },
    { id: "qwen3-coder-plus", label: "Qwen3 Coder Plus", tier: "reasoning" }
  ]
};

let catalog: ModelCatalog = cloneCatalog(DEFAULT_CATALOG);

export function getModelCatalog(): ModelCatalog {
  return cloneCatalog(catalog);
}

export function getSuggestedModels(provider?: Provider): ModelSuggestion[] {
  if (!provider) {
    return [
      ...catalog.openai,
      ...catalog.anthropic,
      ...catalog.qwen
    ];
  }
  return [...catalog[provider]];
}

export function getDefaultModel(provider: Provider): string {
  const models = catalog[provider];
  const recommended = models.find((model) => model.recommended);
  return recommended?.id ?? models[0]?.id ?? fallbackDefault(provider);
}

export function updateModelCatalog(next: Partial<ModelCatalog>): ModelCatalog {
  const updated: ModelCatalog = {
    openai: next.openai ? [...next.openai] : [...catalog.openai],
    anthropic: next.anthropic ? [...next.anthropic] : [...catalog.anthropic],
    qwen: next.qwen ? [...next.qwen] : [...catalog.qwen]
  };

  catalog = updated;
  return cloneCatalog(catalog);
}

export async function updateModelCatalogFromUrl(url: string): Promise<ModelCatalog> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch model catalog (${response.status})`);
  }

  const json = (await response.json()) as Partial<ModelCatalog>;
  return updateModelCatalog(json);
}

function cloneCatalog(source: ModelCatalog): ModelCatalog {
  return {
    openai: [...source.openai],
    anthropic: [...source.anthropic],
    qwen: [...source.qwen]
  };
}

function fallbackDefault(provider: Provider): string {
  if (provider === "anthropic") {
    return "claude-sonnet-4-20250514";
  }
  if (provider === "qwen") {
    return "qwen-plus";
  }
  return "gpt-5-mini";
}
