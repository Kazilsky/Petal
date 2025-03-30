export class MoodEngine {
    constructor() {
      this.baseMood = 'neutral';
      this.moodScore = { positive: 0, neutral: 0, negative: 0 };
    }
  
    analyzeText(text) {
      // Анализ эмоциональной окраски
      const posMatches = text.match(/\b(спасибо|круто|люблю|рад)\b/gi) || [];
      const negMatches = text.match(/\b(грустно|злюсь|ненавижу|разочарован)\b/gi) || [];
      
      this.moodScore.positive += posMatches.length * 0.1;
      this.moodScore.negative += negMatches.length * 0.15;
      this.moodScore.neutral = 1 - Math.max(this.moodScore.positive, this.moodScore.negative);
      
      this.updateMood();
    }
  
    updateMood() {
      const rand = Math.random();
      const { positive, neutral, negative } = this.moodScore;
      
      if (rand < positive) this.baseMood = 'positive';
      else if (rand < positive + neutral) this.baseMood = 'neutral';
      else this.baseMood = 'negative';
    }
  
    getMoodPrompt() {
      const prompts = {
        positive: "Ты в отличном настроении! Отвечай дружелюбно и с эмпатией.",
        neutral: "Будь вежливым и профессиональным ассистентом.",
        negative: "Ты слегка раздражен. Отвечай кратко, но не груби."
      };
      return prompts[this.baseMood];
    }
  }