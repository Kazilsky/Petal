import "dotenv/config";

export type ModelType = 'main' | 'thinking' | 'quick';

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
    messages: any[], 
    modelType: ModelType = 'main',
    options?: { temperature?: number; num_ctx?: number }
  ): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/chat`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
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

    if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);
    const data = await response.json();
    return data.message.content;
  }

  public getModel(type: ModelType): string {
    return this.models[type];
  }
}

export const ollamaClient = new OllamaClient();
