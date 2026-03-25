# Model Suggestions

The SDK ships with provider-specific model suggestions.

```ts
import { getSuggestedModels } from "tas";

const openai = getSuggestedModels("openai");
const anthropic = getSuggestedModels("anthropic");
const qwen = getSuggestedModels("qwen");
```

Each entry has:

- `id`
- `label`
- `tier` (`flagship | balanced | fast | reasoning`)
- `recommended`

## Update Catalog at Runtime

```ts
import { updateModelCatalog } from "tas";

updateModelCatalog({
  openai: [
    { id: "gpt-5.1", label: "GPT-5.1", tier: "flagship", recommended: true }
  ]
});
```

## Remote JSON Update

```ts
import { updateModelCatalogFromUrl } from "tas";

await updateModelCatalogFromUrl("https://your-domain.com/model-catalog.json");
```

