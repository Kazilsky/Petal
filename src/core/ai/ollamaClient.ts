import "dotenv/config";

export type ModelType = 'main' | 'thinking' | 'quick';

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
}

export const ollamaClient = new OllamaClient();
