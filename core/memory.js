import fs from "fs";
import { ApiNeiro } from "../AI.js";

class MemorySystem {
  constructor() {
    this.tempMemory = []; // { channelId: Message[] }
    this.permMemory = this.loadPermMemory();
  }

  loadPermMemory() {
    try {
      return JSON.parse(fs.readFileSync("./perm_memory.json"));
    } catch {
      return { keywords: [], facts: [] };
    }
  }

  savePermMemory() {
    fs.writeFileSync("./perm_memory.json", JSON.stringify(this.permMemory));
  }

  async assessImportance(message, context = []) {
    // 1. Определяем, обращаются ли к боту по имени
    const isMentioned = this.checkMention(message);

    // 2. Анализируем контекст через ИИ
    await ApiNeiro.askAIForImportance(message, context).then((aiAssessment) => {
      // 3. Комбинируем метрики
      return this.calculateFinalScore(isMentioned, aiAssessment);
    });
  }

  checkMention(message) {
    const botMentions = [
      new RegExp(`^<@!?${"Петал"}>`, "i"), // @бот
      /нейро?/i,
      /петал?/i,
      /ai\b/i,
    ];
    return botMentions.some((regex) => regex.test(message));
  }

  calculateFinalScore(isMentioned, aiScore) {
    let score = aiScore;

    // Повышаем важность при прямом обращении
    if (isMentioned) {
      score = Math.min(score + 0.3, 1.0);
    }
    return score;
  }

  updateMemory(channelId, userMsg, aiMsg, importance, user) {
    // Временная память (последние 8 сообщений)
    const history = this.tempMemory || [];
    this.tempMemory.push(
      ...history.slice(-199),
      {
        role: "system",
        content: `Имя пользователя в данном сообщении: ${user}`,
      },
      {
        role: 'system',
        content: `Имя пользователя: ${user}`
      },
      {
        role: 'system',
        content: `Айди канала: ${channelId}`
      },
      { role: 'user', content: userMsg },
      { role: 'assistant', content: aiMsg }
    );

    // Долговременная память (если важно)
    if (importance > 0.65) {
      this.permMemory.facts.push(`${userMsg} → ${aiMsg}`);
      this.savePermMemory();
    }
  }
}

export default new MemorySystem();

