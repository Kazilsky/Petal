export class MoodEngine {
  constructor() {
      this.baseMood = 'neutral';
      this.moodScore = {
          positive: 0,
          neutral: 1, // Начинаем с нейтрального состояния
          negative: 0
      };
      this.moodStates = {
          positive: ['радостная', 'воодушевленная', 'любопытная'],
          neutral: ['сосредоточенная', 'наблюдательная', 'аналитическая'],
          negative: ['раздраженная', 'уставшая', 'скептическая']
      };
      this.currentSubMood = this.moodStates.neutral[0];
      this.moodHistory = [];
  }

  analyzeText(text) {
      // Инициализация счетчиков, если они не существуют
      if (!this.moodScore) {
          this.moodScore = {
              positive: 0,
              neutral: 1,
              negative: 0
          };
      }

      // Более сложный анализ текста
      const posTriggers = [
          { regex: /\b(спасибо|благодарю)\b/gi, weight: 0.15 },
          { regex: /\b(круто|супер|отлично)\b/gi, weight: 0.1 },
          { regex: /(\u2764|\u2665)|сердечко/gi, weight: 0.2 }
      ];
      
      const negTriggers = [
          { regex: /\b(грустно|печально)\b/gi, weight: 0.1 },
          { regex: /\b(злюсь|ненавижу|бесит)\b/gi, weight: 0.2 },
          { regex: /(\u2639|\u26D4)/gi, weight: 0.15 }
      ];

      // Сбрасываем счетчики перед анализом нового текста
      this.moodScore.positive = 0;
      this.moodScore.negative = 0;

      posTriggers.forEach(t => {
          const matches = text.match(t.regex) || [];
          this.moodScore.positive += matches.length * t.weight;
      });

      negTriggers.forEach(t => {
          const matches = text.match(t.regex) || [];
          this.moodScore.negative += matches.length * t.weight;
      });

      // Нормализация значений
      const total = this.moodScore.positive + this.moodScore.negative;
      if (total > 1) {
          this.moodScore.positive /= total;
          this.moodScore.negative /= total;
      }
      
      this.moodScore.neutral = 1 - (this.moodScore.positive + this.moodScore.negative);
      
      this.updateMood();
  }

  updateMood() {
      if (!this.moodScore) {
          this.moodScore = {
              positive: 0,
              neutral: 1,
              negative: 0
          };
      }

      // Определяем основное настроение
      if (this.moodScore.positive > this.moodScore.negative && 
          this.moodScore.positive > this.moodScore.neutral) {
          this.baseMood = 'positive';
      } else if (this.moodScore.negative > this.moodScore.positive && 
                this.moodScore.negative > this.moodScore.neutral) {
          this.baseMood = 'negative';
      } else {
          this.baseMood = 'neutral';
      }

      // Выбираем под-настроение
      this.currentSubMood = this.moodStates[this.baseMood][
          Math.floor(Math.random() * this.moodStates[this.baseMood].length)
      ];
      
      // Сохраняем историю настроений
      this.moodHistory.push({
          mood: this.baseMood,
          subMood: this.currentSubMood,
          timestamp: Date.now()
      });
      
      if (this.moodHistory.length > 10) {
          this.moodHistory.shift();
      }
  }

  getMoodPrompt() {
      if (!this.baseMood || !this.currentSubMood) {
          this.baseMood = 'neutral';
          this.currentSubMood = this.moodStates.neutral[0];
      }

      const moodDescriptions = {
          positive: 
            `Ты чувствуешь себя ${this.currentSubMood} и полна энергии. ` +
            `Отвечай тепло и с энтузиазмом, можешь использовать дружелюбные эмодзи. ` +
            `Проявляй искренний интерес к собеседнику.`,
          neutral: 
            `Ты в состоянии "${this.currentSubMood}". Сохраняй профессиональный ` +
            `и вежливый тон. Будь точной в формулировках, но не слишком сухой.`,
          negative: `Ты ${this.currentSubMood}. Отвечай кратко, можешь позволить себе ` +
            `легкий сарказм (но не грубость). Если запрос важный, соберись ` +
            `и ответь максимально четко.`
      };
      
      return moodDescriptions[this.baseMood];
  }
}
