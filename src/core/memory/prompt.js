import fs from "fs";
// import { validatePath } from '../../utils/fileManager.js';

export class MemorySystem {
  constructor() {
    this.tempMemory = []; // { channelId: Message[] }
    this.permMemory = this.loadPermMemory();
  }

  getContext(limit = 100) {
    if (!this.tempMemory || this.tempMemory.length === 0) {
      return [];
    }

    // Фильтруем только user/assistant сообщения и ограничиваем количество
    const filteredContext = this.tempMemory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-limit * 2); // Умножаем на 2, так как учитываем пары вопрос-ответ

    // Форматируем контекст для LLM
    return filteredContext.map(msg => ({
      role: msg.role,
      content: this.formatMessageContent(msg)
    }));
  }

  formatMessageContent(msg) {
    if (msg.role === 'system') {
      return msg.content;
    }
    
    // Для пользовательских сообщений добавляем имя, если есть
    if (msg.role === 'user' && msg.username) {
      return `${msg.username}: ${msg.content}`;
    }
    
    // Для ассистента просто возвращаем контент
    return msg.content;
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

