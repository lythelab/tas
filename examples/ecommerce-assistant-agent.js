require("dotenv").config();
const { createTelegramAgent, createMemory } = require("tas");

const products = [
  { id: "P100", name: "Noise-Canceling Headphones", price: 149, stock: 11 },
  { id: "P200", name: "Mechanical Keyboard", price: 89, stock: 24 },
  { id: "P300", name: "4K Webcam", price: 119, stock: 7 }
];

const orders = [];

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN,
  llm: {
    provider: process.env.LLM_PROVIDER || "anthropic",
    model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
    apiKey:
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.QWEN_API_KEY ||
      process.env.DASHSCOPE_API_KEY
  },
  systemPrompt: "You are an ecommerce assistant. Help users discover products and place mock orders.",
  tools: [
    {
      name: "search_products",
      description: "Search products by keyword",
      execute: async ({ query = "" }) => {
        const q = String(query).toLowerCase();
        return products.filter((p) => p.name.toLowerCase().includes(q));
      }
    },
    {
      name: "check_stock",
      description: "Check stock for product id",
      execute: async ({ productId = "" }) => {
        const item = products.find((p) => p.id === productId);
        return item ? { id: item.id, name: item.name, stock: item.stock } : { error: "Product not found" };
      }
    },
    {
      name: "create_order",
      description: "Create a mock order with productId and quantity",
      execute: async ({ productId = "", quantity = 1, customer = "guest" }) => {
        const item = products.find((p) => p.id === productId);
        if (!item) return { error: "Product not found" };
        const qty = Number(quantity);
        if (qty <= 0) return { error: "Quantity must be greater than 0" };
        if (item.stock < qty) return { error: "Insufficient stock", available: item.stock };

        item.stock -= qty;
        const order = {
          id: `ORD-${Date.now()}`,
          customer,
          productId: item.id,
          quantity: qty,
          total: qty * item.price,
          status: "confirmed",
          createdAt: new Date().toISOString()
        };
        orders.push(order);
        return order;
      }
    }
  ],
  memory: createMemory({ provider: "memory", limit: 30 }),
  webhook: { port: 3000, path: "/webhook", autoRegister: false },
  typing: true,
  isDev: true
});

agent.start().then(() => {
  console.log("ecommerce-assistant-agent running on http://localhost:3000/webhook");
}).catch(console.error);
