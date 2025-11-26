import fs from "fs";
import path from "path";
import { MemoryMessage, PermanentMemory } from "../ai.types";

// Интерфейс для структуры факта
interface MemoryFact {
  content: string;
  keywords: string[];
  createdAt: number;
}

// Расширяем тип, если он у вас простой
interface ExtendedPermanentMemory {
  facts: MemoryFact[];
}

export class MemorySystem {
  private tempMemory: MemoryMessage[] = [];
  private permMemory: ExtendedPermanentMemory;
  private additionalNote: Record<string, string> = {};
  private readonly MEMORY_FILE = path.resolve("./perm_memory.json");

  constructor() {
    this.permMemory = this.loadPermanentMemory();
  }

  /**
   * Формирует контекст для отправки в AI.
   * Теперь включает в себя релевантные факты из долгосрочной памяти.
   */
  public getContext(limit = 20): MemoryMessage[] {
    // 1. Берем последние N сообщений из истории
    const recentHistory = this.tempMemory
      .filter(
        (msg) =>
          msg.role === "user" ||
          msg.role === "assistant" ||
          msg.role === "system",
      )
      .slice(-limit * 2);

    // 2. Пытаемся найти последнее сообщение пользователя для поиска контекста
    const lastUserMessage = [...recentHistory].reverse().find(m => m.role === 'user')?.content || "";

    // 3. Ищем релевантные факты в перманентной памяти
    const relevantFacts = this.findRelevantFacts(lastUserMessage);

    let systemInjection: MemoryMessage | null = null;

    if (relevantFacts.length > 0) {
      systemInjection = {
        role: "system",
        content: `Вспомогательная информация из памяти:\n${relevantFacts.join("\n")}`
      };
    }

    // 4. Собираем всё вместе: Заметки + Найденные факты + История
    const context: MemoryMessage[] = [];

    // Добавляем глобальные заметки, если есть
    const notes = this.getAdditionalNote();
    if (notes) {
      context.push({ role: "system", content: `Важные инструкции:\n${notes}` });
    }

    if (systemInjection) {
      context.push(systemInjection);
    }

    return [...context, ...recentHistory];
  }

  public getAdditionalNote(): string {
    // Исправлено: .toString() у объекта возвращает [object Object]
    if (Object.keys(this.additionalNote).length === 0) return "";

    return Object.entries(this.additionalNote)
      .map(([key, val]) => `[${key}]: ${val}`)
      .join("\n");
  }

  public setNote(name: string, newPrompt: string): void {
    this.additionalNote[name] = newPrompt;
  }

  public unsetNote(name: string): boolean {
    if (this.additionalNote.hasOwnProperty(name)) {
      delete this.additionalNote[name];
      return true;
    }
    return false;
  }

  public updateMemory(
    channelId: string,
    userMessage: string,
    aiResponse: string,
    importance: number, // Ожидается от 0 до 1
    username: string,
  ): void {
    // Добавляем в оперативную память
    this.tempMemory.push(
      {
        role: "system",
        content: `Info: User=${username}, Chan=${channelId}`,
      },
      { role: "user", content: userMessage, username },
      { role: "assistant", content: aiResponse },
    );

    // Ограничиваем размер оперативной памяти (например, 200 сообщений)
    if (this.tempMemory.length > 200) {
      this.tempMemory = this.tempMemory.slice(-200);
    }

    // Логика сохранения в перманентную память
    if (importance > 0.65) {
      const factContent = `${userMessage} -> ${aiResponse}`;

      // Простая генерация ключевых слов (разбиваем на слова, убираем короткие)
      const keywords = [...new Set([
        ...userMessage.toLowerCase().split(/[\s,.!?]+/),
        ...aiResponse.toLowerCase().split(/[\s,.!?]+/)
      ])].filter(w => w.length > 3);

      this.permMemory.facts.push({
        content: factContent,
        keywords: keywords,
        createdAt: Date.now()
      });

      this.savePermanentMemory();
    }
  }

  /**
   * Простой алгоритм поиска по ключевым словам.
   * В идеале тут нужно использовать векторный поиск (Embeddings),
   * но для JSON-файла подойдет пересечение слов.
   */
  private findRelevantFacts(query: string): string[] {
    if (!query) return [];

    const queryWords = query.toLowerCase().split(/[\s,.!?]+/).filter(w => w.length > 3);

    if (queryWords.length === 0) return [];

    // Сортируем факты по количеству совпадений ключевых слов
    const scoredFacts = this.permMemory.facts.map(fact => {
      let score = 0;
      queryWords.forEach(word => {
        if (fact.keywords.includes(word)) score++;
        // Бонус, если слово есть в самом тексте
        if (fact.content.toLowerCase().includes(word)) score += 0.5;
      });
      return { fact, score };
    });

    // Берем топ-3 факта, у которых score > 0
    return scoredFacts
      .filter(item => item.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Ограничиваем кол-во, чтобы не забить контекст
      .map(item => item.fact.content);
  }

  private loadPermanentMemory(): ExtendedPermanentMemory {
    try {
      const data = fs.readFileSync(this.MEMORY_FILE, "utf-8");
      const parsed = JSON.parse(data);

      // Миграция старого формата (если там были просто строки)
      if (parsed.facts && parsed.facts.length > 0 && typeof parsed.facts[0] === 'string') {
        return {
          facts: parsed.facts.map((f: string) => ({
            content: f,
            keywords: [],
            createdAt: Date.now()
          }))
        };
      }

      return parsed.facts ? parsed : { facts: [] };
    } catch {
      return { facts: [] };
    }
  }

  private savePermanentMemory(): void {
    fs.writeFileSync(
      this.MEMORY_FILE,
      JSON.stringify(this.permMemory, null, 2),
    );
  }
}
