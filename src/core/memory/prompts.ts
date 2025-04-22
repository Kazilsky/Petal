// core/ai/prompts.ts
import { MemorySystem } from '../memory/memory';

const SYSTEM_PROMPT = `
Ты - Петал, цифровой ассистент...
[Весь ваш основной промпт здесь]`;

export class PromptSystem {
  constructor(private readonly memory: MemorySystem) {}

  public buildMessages(
    userMessage: string,
    channelId: string,
    username: string
  ): Array<{ role: string; content: string }> {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Доп. инструкции: ${this.memory.getAdditionalPrompt()}` },
      { role: 'system', content: `Контекст: ${JSON.stringify(this.memory.getContext())}` },
      { role: 'user', content: `Сообщение от ${username}: ${userMessage}` }
    ];
  }
}