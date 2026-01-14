import { MemorySystem } from "../memory/memory";
import { PromptSystem } from "./PromptSystem";
import { openRouterClient } from "./ollamaClient";
import { AIActionHandler } from "./actions";
import { SystemControl } from "../system/systemControl";
import { ThinkingModule } from "../thinking/thinking";
import "dotenv/config";

export interface AIResponseParams {
  message: string;
  channelId: string;
  user: { username: string; id?: string };
  platform?: string;
}

export class ApiNeiro {
  private readonly prompts: PromptSystem;
  private readonly memory: MemorySystem;
  private readonly actionHandler: AIActionHandler;

  constructor() {
    this.memory = new MemorySystem();
    this.prompts = new PromptSystem(this.memory);
    this.actionHandler = new AIActionHandler(this.memory);
  }

  // Inject dependencies for action handler
  public setSystemControl(systemControl: SystemControl): void {
    this.actionHandler.setSystemControl(systemControl);
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.actionHandler.setThinkingModule(thinkingModule);
  }

  async generateResponse(params: AIResponseParams): Promise<string> {
    // 1. Строим промпт
    const messages = this.prompts.buildMessages(
      params.message,
      params.channelId,
      params.user.username,
    );

    // 2. Запрос к AI
    const raw = await openRouterClient.query(messages, "main");

    // 3. Обработка AI Actions (до проверки на молчание!)
    await this.processActions(raw);

    // 4. Проверка на молчание
    if (this.shouldNotRespond(raw)) {
      return "[NO_RESPONSE]";
    }

    // 5. Чистим ответ
    const { clean, importance } = this.parseResponse(raw);

    // 6. Сохраняем в память
    this.memory.updateMemory(
      params.channelId,
      params.message,
      clean,
      importance,
      params.user.username,
    );

    return clean;
  }

  /**
   * Парсит и выполняет [AI_ACTION:name]params[/AI_ACTION]
   */
  private async processActions(text: string): Promise<void> {
    const actionRegex = /\[AI_ACTION:(.*?)\](.*?)\[\/AI_ACTION\]/gs;
    const matches = [...text.matchAll(actionRegex)];

    for (const match of matches) {
      const actionName = match[1].trim();
      const paramsText = match[2].trim();

      try {
        let params: any = {};

        if (paramsText) {
          // Пробуем JSON
          if (paramsText.startsWith("{") || paramsText.startsWith("[")) {
            try {
              params = JSON.parse(paramsText);
            } catch {
              console.warn(
                `[AI Action] Failed to parse JSON for ${actionName}`,
              );
            }
          } else {
            // Иначе key:value формат
            params = this.parseKeyValue(paramsText);
          }
        }

        // Выполняем действие
        console.log(`[AI Action] Executing: ${actionName}`, params);
        await this.actionHandler.execute(actionName, params);
      } catch (error) {
        console.error(`[AI Action Error] ${actionName}:`, error);
      }
    }
  }

  /**
   * Парсит простой key:value формат
   * Пример: "name: test\nprompt: hello world\nmessage: updated"
   */
  private parseKeyValue(text: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Типизация значений
      if (value === "true") result[key] = true;
      else if (value === "false") result[key] = false;
      else if (!isNaN(Number(value)) && value !== "")
        result[key] = Number(value);
      else result[key] = value;
    }

    return result;
  }

  private shouldNotRespond(text: string): boolean {
    const t = text.trim().toLowerCase();
    return (
      t.includes("[no_response]") ||
      t.includes("(no_response)") ||
      t === "" ||
      t === "(промолчать)"
    );
  }

  private parseResponse(text: string): { clean: string; importance: number } {
    let clean = text;
    let importance = 0.3;

    // Извлекаем [MEMORY:X.X]
    const match = text.match(/\[MEMORY:(\d+\.?\d*)\]/);
    if (match) {
      importance = Math.min(parseFloat(match[1]), 1);
      clean = text.replace(/\[MEMORY:\d+\.?\d*\]/g, "").trim();
    }

    // Убираем служебные теги
    clean = clean
      .replace(/\[MATCHING_HISTORY_SCORE:.*?\]/g, "")
      .replace(/\[AI_ACTION:.*?\].*?\[\/AI_ACTION\]/gs, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return { clean, importance };
  }

  public async quickCheck(
    message: string,
    username: string,
    recentHistory: string[],
    ignoredUsers: string[],
  ): Promise<boolean> {
    return openRouterClient.quickCheck(
      message,
      username,
      recentHistory,
      ignoredUsers,
    );
  }

  getMemory(): MemorySystem {
    return this.memory;
  }

  getActionHandler(): AIActionHandler {
    return this.actionHandler;
  }
}
