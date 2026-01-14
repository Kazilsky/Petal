import "dotenv/config";

export type ModelType = "main" | "thinking" | "quick";

// Garbage message patterns that should be immediately rejected
const GARBAGE_PATTERNS =
  /^[.\s…]+$|^(лол|ахах|хах|имба|\+1|1|ок|окей|да|нет|гг|gg|\.{2,})$/i;

// Bot mention patterns
const MENTION_PATTERNS = /петал|petal|бот/i;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  username?: string;
}

export class OpenRouterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly models: Record<ModelType, string>;
  private readonly siteUrl: string;
  private readonly siteName: string;

  constructor() {
    this.baseUrl = process.env.OPENROUTER_URL || "https://openrouter.ai/api/v1";
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    this.siteUrl = process.env.SITE_URL || "http://localhost";
    this.siteName = process.env.SITE_NAME || "Petal Bot";

    this.models = {
      main: process.env.OPENROUTER_MODEL || "mistralai/devstral-2512:free",
      thinking:
        process.env.OPENROUTER_THINKING_MODEL ||
        process.env.OPENROUTER_MODEL ||
        "mistralai/devstral-2512:free",
      quick:
        process.env.OPENROUTER_QUICK_MODEL || "mistralai/devstral-2512:free",
    };
  }

    public async query(
    messages: ChatMessage[],
    modelType: ModelType = "main",
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": this.siteUrl,
      "X-Title": this.siteName,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.models[modelType],
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options?.temperature ?? 0.6,
        max_tokens: options?.max_tokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter API Error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      );
    }

    const data = await response.json();

    // Validate response structure (OpenAI-compatible format)
    if (
      !data ||
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message
    ) {
      throw new Error(
        `Invalid OpenRouter API response structure: ${JSON.stringify(data)}`,
      );
    }

    return data.choices[0].message.content;
  }

  public getModel(type: ModelType): string {
    return this.models[type];
  }

  /**
   * QuickCheck with context and ignore list
   * Determines if the bot should respond to a message
   */
  public async quickCheck(
    message: string,
    username: string,
    recentHistory: string[] = [],
    ignoredUsers: string[] = [],
  ): Promise<boolean> {
    // Ignore list - immediate no
    if (ignoredUsers.includes(username.toLowerCase())) {
      return false;
    }

    // Obvious garbage - immediate no
    if (GARBAGE_PATTERNS.test(message.trim())) {
      return false;
    }

    // Too short with only special chars
    if (/^[.,!?;:\s]+$/.test(message.trim())) {
      return false;
    }

    // Direct mention - always yes
    if (MENTION_PATTERNS.test(message)) {
      return true;
    }

    // For everything else - ask the model WITH CONTEXT
    const historyContext =
      recentHistory.length > 0
        ? `\n## 📜 ИСТОРИЯ ЧАТА (последние сообщения):\n${recentHistory.join("\n")}\n`
        : "\n## 📜 ИСТОРИЯ ЧАТА: (нет данных)\n";

    try {
      const result = await this.query(
        [
          {
            role: "system",
            content: `Ты — умный фильтр для чат-бота "Петал".
Твоя задача: проанализировать последнее сообщение и историю чата, чтобы решить — стоит ли боту отвечать.

${historyContext}

## 🚦 ИНСТРУКЦИЯ

Ответь **ТОЛЬКО** "YES" или "NO".

### ✅ YES (Отвечать), если:
1.  **Прямое обращение:** Имя "Петал", "Petal", "бот" или вопрос, явно адресованный ИИ.
2.  **Помощь:** Пользователь задает технический вопрос или просит помощи, и никто другой еще не ответил.
3.  **Участие в беседе:** Бот уже участвует в этом диалоге (см. историю), и ему задали уточняющий вопрос.
4.  **Интересная тема:** Общий вопрос ко всем участникам чата ("Кто знает...", "Как думаете...").

### ❌ NO (Молчать), если:
1.  **Чужой диалог:** Идет активное общение двух и более людей, и бота не звали. **ЭТО САМОЕ ВАЖНОЕ ПРАВИЛО.**
2.  **Короткие реакции:** "ахах", "лол", "пон", "ок", "спасибо", эмодзи.
3.  **Адресное сообщение:** Сообщение начинается с @username (если это не бот).
4.  **Завершенность:** Бот уже дал ответ, и пользователь просто подтвердил получение ("понял", "спасибо").
5.  **Неуверенность:** Если не очевидно, что обращаются к боту — лучше промолчи.

Твой ответ (YES/NO):`,
          },
          {
            role: "user",
            content: `Username: ${username}\nMessage: ${message}\n\nБоту отвечать?`,
          },
        ],
        "quick",
        { temperature: 0.1, max_tokens: 10 },
      );

      return result.trim().toUpperCase().startsWith("YES");
    } catch (error) {
      console.error("[QuickCheck Error]", error);
      return false;
    }
  }
}

export const openRouterClient = new OpenRouterClient();
