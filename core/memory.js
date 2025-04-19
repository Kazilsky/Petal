import fs from 'fs';
import { ApiNeiro } from '../AI.js';

class MemorySystem {
  constructor() {
    this.tempMemory = new Map(); // { channelId: Message[] }
    this.permMemory = this.loadPermMemory();
  }

  loadPermMemory() {
    try {
      return JSON.parse(fs.readFileSync('./perm_memory.json'));
    } catch {
      return { keywords: [], facts: [] };
    }
  }

  savePermMemory() {
    fs.writeFileSync('./perm_memory.json', JSON.stringify(this.permMemory));
  }

  async assessImportance(message, context = []) {
    // 1. Определяем, обращаются ли к боту по имени
    const isMentioned = this.checkMention(message);
    
    // 2. Анализируем контекст через ИИ
    await ApiNeiro.askAIForImportance(message, context)
    .then((aiAssessment) => {  
      // 3. Комбинируем метрики
      return this.calculateFinalScore(isMentioned, aiAssessment);
    });
  }

  checkMention(message) {
    const botMentions = [
      new RegExp(`^<@!?${'Петал'}>`, 'i'), // @бот
      /нейро?/i,
      /петал?/i,
      /ai\b/i,
    ];
    return botMentions.some(regex => regex.test(message));
  }

  calculateFinalScore(isMentioned, aiScore) {
    let score = aiScore;
    
    // Повышаем важность при прямом обращении
    if (isMentioned) {
      score = Math.min(score + 0.3, 1.0);
    }
    
    // Понижаем для тривиальных ответов
    /*if (score < 0.2 && !isMentioned) {
      score = 0;
    }*/
    
    console.log(score);
    return score;
  }

  updateMemory(channelId, userMsg, aiMsg, importance) {
    // Временная память (последние 8 сообщений)
    const history = this.tempMemory.get(channelId) || [];
    this.tempMemory.set(channelId, [
      ...history.slice(-9),
      { role: 'user', content: userMsg },
      { role: 'assistant', content: aiMsg }
    ]);

    // Долговременная память (если важно)
    if (importance > 0.65) {
      this.permMemory.facts.push(`${userMsg} → ${aiMsg}`);
      this.savePermMemory();
    }
  }
}

export default new MemorySystem();