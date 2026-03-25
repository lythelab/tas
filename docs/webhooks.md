# Webhook Deployment

## Built-in server

```ts
const agent = createTelegramAgent({
  token,
  webhook: {
    port: 3000,
    path: "/webhook",
    url: "https://my-domain.com",
    autoRegister: true,
    secretToken: "my-secret"
  }
});

await agent.start();
```

## External server mode

```ts
const agent = createTelegramAgent({
  token,
  webhook: { external: true, secretToken: "my-secret" }
});

app.post("/webhook", async (req, res) => {
  await agent.handler()(req.body, req.headers as Record<string, string>);
  res.status(200).json({ ok: true });
});
```

## Performance notes

- webhook route returns immediately with `200`.
- message processing runs async to avoid Telegram timeout pressure.
- each chat is processed independently via per-chat memory state.

## Dashboard note

When `isDev: true`, dashboard runs on a separate server (default `http://127.0.0.1:5173`) and is independent from webhook port.
