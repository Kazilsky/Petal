// test.js
import 'dotenv/config';

const API_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
  fallbackModel: 'huggingfaceh4/zephyr-7b-beta:free',
  maxRetries: 2,
  timeout: 15000
};

// Система памяти (хранит историю по channelId)
const memory = new Map();

export const ApiNeiro = {
  async test(question, { mood = 'neutral', channelId = null } = {}) {
    try {
      // Получаем историю чата если есть channelId
      const chatHistory = channelId ? memory.get(channelId) || [] : [];
      console.log(chatHistory);
      
      // Формируем системный промпт с настроением
      const systemPrompt = this.getMoodPrompt(mood);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6), // Берем последние 6 сообщений
        { role: 'user', content: question }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: API_CONFIG.defaultModel,
          messages,
          temperature: mood === 'creative' ? 0.9 : 0.7,
          max_tokens: 2000
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aiMessage = data.choices[0].message;

      // Сохраняем в память (если есть channelId)
      if (channelId) {
        const updatedHistory = [
          ...chatHistory,
          { role: 'user', content: question },
          aiMessage
        ];
        memory.set(channelId, updatedHistory.slice(-10)); // Ограничиваем историю
      }

      return aiMessage;

    } catch (error) {
      this.log(`Ошибка: ${error.message}. Пробую fallback модель`, 'warn');
      
      // Пробуем fallback модель с упрощенным запросом
      try {
        const fallbackResponse = await fetch(API_CONFIG.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: API_CONFIG.fallbackModel,
            messages: [{ role: 'user', content: question }],
            max_tokens: 1500
          })
        });

        if (!fallbackResponse.ok) throw new Error('Fallback модель тоже не сработала');
        
        const data = await fallbackResponse.json();
        return data.choices[0].message;
        
      } catch (fallbackError) {
        this.log(`Критическая ошибка: ${fallbackError.message}`, 'error');
        throw new Error('⚠️ Все модели недоступны. Попробуйте позже.');
      }
    }
  },

  getMoodPrompt(mood) {
    const moods = {
      neutral: "Ты полезный AI ассистент. Отвечай точно и информативно.",
      friendly: "Ты дружелюбный AI. Будь теплым и поддерживающим в общении.",
      professional: "Ты профессиональный ассистент. Отвечай кратко и по делу.",
      creative: "Ты креативный AI. Проявляй творческий подход и не бойся нестандартных идей.",
      sarcastic: "Ты саркастичный AI. Отвечай с юмором и легкой иронией."
    };
    return moods[mood] || moods.neutral;
  },

  log(message, level = 'info', discordapi = null) {
    const timestamp = new Date().toISOString();
    const levels = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    };
    console.log(`${timestamp} ${levels[level] || ''} [ApiNeiro]: ${message}`);
    
    // Для ошибок можно добавить отправку в специальный Discord-канал
    if (level === 'error') {
      return 0;
    }
  },

  // Очистка памяти для канала
  clearMemory(channelId) {
    memory.delete(channelId);
    this.log(`Память очищена для канала ${channelId}`);
  }
};