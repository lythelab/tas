export class TelegramClient {
  private readonly token: string;
  private readonly baseURL: string;

  constructor(token: string, baseURL = "https://api.telegram.org") {
    this.token = token;
    this.baseURL = `${baseURL}/bot${token}`;
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
    }
  }

  async setWebhook(url: string, options?: { secretToken?: string }): Promise<void> {
    const response = await fetch(`${this.baseURL}/setWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        secret_token: options?.secretToken
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram setWebhook failed (${response.status}): ${body}`);
    }
  }

  async sendChatAction(chatId: number | string, action: "typing" = "typing"): Promise<void> {
    const response = await fetch(`${this.baseURL}/sendChatAction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        action
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram sendChatAction failed (${response.status}): ${body}`);
    }
  }
}
