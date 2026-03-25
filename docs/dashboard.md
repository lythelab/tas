# Dashboard

When `isDev: true`, TAS starts a standalone dashboard server.

Default URL:
- `http://127.0.0.1:5173`

Configuration:

```ts
createTelegramAgent({
  token,
  isDev: true,
  dev: {
    port: 5173,
    host: "127.0.0.1"
  }
});
```

Features:
- Inngest-inspired runs view
- Live event feed
- Timeline panel by chat
- Real-time updates through SSE stream
- Event payload inspection for each row

Notes:
- Dashboard runs separately from webhook port.
- Webhook can stay on `3000` while dashboard stays on `5173`.
