import { MemorySystem } from "../memory/memory";
import { PromptSystem } from "./prompts";
import { AIActionHandler } from "./actions";
import { AIResponseParams } from "../ai.types";

import "dotenv/config";

export class ApiNeiro {
  private readonly promptSystem: PromptSystem;
  private readonly actionHandler: AIActionHandler;
  private readonly memory: MemorySystem;

  constructor() {
    this.memory = new MemorySystem();
    this.promptSystem = new PromptSystem(this.memory);
    this.actionHandler = new AIActionHandler(this.memory);
  }

  public async generateResponse(params: AIResponseParams): Promise<string> {
    // 1. Строим сообщения (внутри promptSystem нужно убедиться, 
    // что вызывается memory.getContext(), чтобы подтянуть старые факты)
    const messages = this.promptSystem.buildMessages(
      params.message,
      params.channelId,
      params.user.username,
    );

    // 2. Получаем "грязный" ответ от AI (с тегами)
    const rawResponse = await this.queryAI(messages);

    // 3. Извлекаем важность (importance) и очищаем текст
    const { cleanResponse, importance } = this.extractImportance(rawResponse);

    // 4. Обновляем память с реальной оценкой важности
    this.memory.updateMemory(
      params.channelId,
      params.message,
      cleanResponse, // Сохраняем чистый текст без тега важности
      importance,    // Если > 0.65, улетит в перманентную память
      params.user.username,
    );

    // 5. Обрабатываем действия (actions) и возвращаем итог
    return this.processResponse(cleanResponse);
  }

  /**
   * Парсит ответ на наличие тега [MEMORY:0.0-1.0]
   */
  private extractImportance(text: string): { cleanResponse: string; importance: number } {
    const importanceRegex = /\[MEMORY:(\d+(\.\d+)?)\]/;
    const match = text.match(importanceRegex);

    let importance = 0;
    let cleanResponse = text;

    if (match) {
      importance = parseFloat(match[1]);
      // Удаляем тег из текста, чтобы пользователь его не видел
      cleanResponse = text.replace(importanceRegex, "").trim();
    }

    // Защита от галлюцинаций (если число > 1)
    if (importance > 1) importance = 1;

    return { cleanResponse, importance };
  }

  private async queryAI(messages: any[]): Promise<string> {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast:free", // Или любой другой
          messages,
          temperature: 0.6,
        }),
      },
    );

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async processResponse(response: string): Promise<string> {
    const actionRegex = /\[AI_ACTION:(\w+)\](.*?)\[\/AI_ACTION\]/gs;
    let processedResponse = response;

    // Используем matchAll и итерируемся
    const matches = Array.from(response.matchAll(actionRegex));

    for (const match of matches) {
      const actionName = match[1];
      const jsonString = match[2];

      try {
        // Используем безопасный парсинг
        const params = this.safeJsonParse(jsonString);

        const result = await this.actionHandler.execute(
          actionName,
          params,
        );

        processedResponse = processedResponse.replace(
          match[0],
          `[${actionName}: ${result.success ? "✓" : "✗"}]`,
        );
      } catch (error) {
        console.error(`Action error [${actionName}]:`, error);
        // Можно заменить тег на сообщение об ошибке, чтобы видеть это в чате
        processedResponse = processedResponse.replace(
          match[0],
          `[Error: ${actionName} failed]`
        );
      }
    }

    return processedResponse;
  }

  /**
   * Умный парсер JSON, который чистит мусор от нейросети
   * Исправляет: {{...}}, {'key': 'val'}, переносы строк
   */
  private safeJsonParse(str: string): any {
    let cleanStr = str.trim();

    // 1. Поиск границ JSON объекта (находим первые { и последние })
    const firstBrace = cleanStr.indexOf('{');
    const lastBrace = cleanStr.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
    }

    // 2. Исправление двойных скобок {{...}} -> {...}
    // Нейросети часто пишут так случайно
    while (cleanStr.startsWith('{{') && cleanStr.endsWith('}}')) {
      cleanStr = cleanStr.substring(1, cleanStr.length - 1);
    }

    try {
      return JSON.parse(cleanStr);
    } catch (e) {
      // 3. Если все еще ошибка, пробуем исправить одинарные кавычки
      try {
        // Заменяем 'key': ... на "key": ...
        // И 'value' на "value", стараясь не задеть апострофы внутри текста
        const fixed = cleanStr
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
          .replace(/:\s*'([^']*)'/g, ': "$1"');

        return JSON.parse(fixed);
      } catch (e2) {
        console.error("CRITICAL JSON PARSE FAIL:", cleanStr);
        return {};
      }
    }
  }
}
