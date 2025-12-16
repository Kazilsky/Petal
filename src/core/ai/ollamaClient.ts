import "dotenv/config";

export type ModelType = 'main' | 'thinking' | 'quick';

// Garbage message patterns that should be immediately rejected
const GARBAGE_PATTERNS = /^[.\s…]+$|^(лол|ахах|хах|имба|\+1|1|ок|окей|да|нет|гг|gg|\.{2,})$/i;

// Bot mention patterns
const MENTION_PATTERNS = /петал|petal|бот/i;

export interface OllamaMessage {
  role: string;
  content: string;
  username?: string;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly models: Record<ModelType, string>;

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.token = process.env.OLLAMA_TOKEN || "";
    this.models = {
      main: process.env.OLLAMA_MODEL || "qwen2.5:14b",
      thinking: process.env.OLLAMA_THINKING_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:14b",
      quick: process.env.OLLAMA_QUICK_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:14b"
    };
  }

  public async query(
    messages: OllamaMessage[], 
    modelType: ModelType = 'main',
    options?: { temperature?: number; num_ctx?: number }
  ): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Only add Authorization header if token is provided
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(
      `${this.baseUrl}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.models[modelType],
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.6,
            num_ctx: options?.num_ctx ?? 8192,
          }
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama API Error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.message || typeof data.message.content !== 'string') {
      throw new Error(`Invalid Ollama API response structure: ${JSON.stringify(data)}`);
    }
    
    return data.message.content;
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
    ignoredUsers: string[] = []
  ): Promise<boolean> {
    
    // Ignore list - immediate no
    // Note: ignoredUsers are already stored in lowercase by MemorySystem
    if (ignoredUsers.includes(username.toLowerCase())) {
      return false;
    }
    
    // Obvious garbage - immediate no (even from creator!)
    if (GARBAGE_PATTERNS.test(message.trim())) {
      return false;
    }
    
    // Если сообщение слишком короткое и содержит только спецсимволы или смайлы
    if (/^[.,!?;:\s]+$/.test(message.trim())) {
      return false;
    }

    // Direct mention - always yes
    if (MENTION_PATTERNS.test(message)) {
      return true;
    }
    
    // For everything else - ask the model WITH CONTEXT
    // Use all provided history (already limited by caller)
    const historyContext = recentHistory.length > 0 
      ? `\n## 📜 ИСТОРИЯ ЧАТА (последние сообщения):\n${recentHistory.join('\n')}\n`
      : '\n## 📜 ИСТОРИЯ ЧАТА: (нет данных)\n';

    try {
      const result = await this.query([
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

Твой ответ (YES/NO):`
        },
        {
          role: "user",
          content: `Username: ${username}\nMessage: ${message}\n\nБоту отвечать?`
        }
      ], 'quick', { temperature: 0.1, num_ctx: 2048 });
      
      return result.trim().toUpperCase().startsWith('YES');
    } catch (error) {
      console.error('[QuickCheck Error]', error);
      return false;
    }
  }
}

export const ollamaClient = new OllamaClient();
