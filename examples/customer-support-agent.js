require("dotenv").config();
const { createTelegramAgent, createMemory } = require("tas");

const faq = {
  refund: "Refunds are supported within 7 days of purchase for eligible plans.",
  shipping: "Standard shipping takes 3-5 business days.",
  pricing: "Pricing starts at $29/month for starter plan."
};

const tickets = [];

const agent = createTelegramAgent({
  token: process.env.TELEGRAM_BOT_TOKEN,
  llm: {
    provider: process.env.LLM_PROVIDER || "openai",
    model: process.env.LLM_MODEL || "gpt-5-mini",
    apiKey:
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.QWEN_API_KEY ||
      process.env.DASHSCOPE_API_KEY
  },
  systemPrompt: "You are a customer support agent. Be empathetic, concise, and solution-first.",
  tools: [
    {
      name: "search_faq",
      description: "Search known FAQ topics: refund, shipping, pricing",
      execute: async ({ topic = "" }) => {
        const key = String(topic).toLowerCase();
        return { topic: key, answer: faq[key] || "No exact FAQ match." };
      }
    },
    {
      name: "create_ticket",
      description: "Create a support ticket with issue details",
      execute: async ({ user = "unknown", issue = "" }) => {
        const ticket = {
          id: `TKT-${Date.now()}`,
          user,
          issue,
          status: "open",
          createdAt: new Date().toISOString()
        };
        tickets.push(ticket);
        return ticket;
      }
    },
    {
      name: "ticket_status",
      description: "Check ticket status by ticket id",
      execute: async ({ id = "" }) => {
        const ticket = tickets.find((t) => t.id === id);
        return ticket || { error: "Ticket not found" };
      }
    }
  ],
  memory: createMemory({ provider: "memory", limit: 30 }),
  webhook: { port: 3000, path: "/webhook", autoRegister: false },
  typing: true,
  isDev: true
});

agent.start().then(() => {
  console.log("customer-support-agent running on http://localhost:3000/webhook");
}).catch(console.error);
