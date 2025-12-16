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
    
    // Direct mention - always yes
    if (MENTION_PATTERNS.test(message)) {
      return true;
    }
    
    // For everything else - ask the model WITH CONTEXT
    // Use all provided history (already limited by caller)
    const historyContext = recentHistory.length > 0 
      ? `\nПоследние сообщения в чате:\n${recentHistory.join('\n')}`
      : '';

    try {
      const result = await this.query([
        {
          role: "system",
          content: `Ты решаешь, нужно ли боту Петал отвечать. Ответь ТОЛЬКО: YES или NO

ОТВЕЧАТЬ (YES):
- Прямое обращение к боту
- Вопрос где бот может помочь
- Интересная тема для обсуждения

НЕ ОТВЕЧАТЬ (NO):
- Мусор: "...", "ок", "лол", эмодзи
- Личный разговор между людьми  
- Бот уже ответил и добавить нечего
- Короткие реакции без смысла
- Сообщение не требует ответа${historyContext}`
        },
        {
          role: "user",
          content: `Username: ${username}\nMessage: ${message}\n\nБоту отвечать?`
        }
      ], 'quick', { temperature: 0.1, num_ctx: 1024 });
      
      return result.trim().toUpperCase().startsWith('YES');
    } catch (error) {
      console.error('[QuickCheck Error]', error);
      return false;
    }
  }
}

export const ollamaClient = new OllamaClient();
