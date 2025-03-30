import 'dotenv/config';
import Memory from './core/memory.js';
import { MoodEngine } from './core/mood.js';

const moodEngine = new MoodEngine();

export const ApiNeiro = {
  async generateAIResponse({ message, channelId }) {
    // 1. Анализ контекста
    const importance = Memory.assessImportance(message);

    moodEngine.analyzeText(message);
    const context = Memory.tempMemory.get(channelId) || [];

    // 1.5 Составление промпта:
    const prompt = `
    Ты Петал, ассистент созданный игроком, текущий функционал не очень велик, 
    1. Оценивать сообщения - ты можешь за своим бекендом устанавливать важность сообщений исходя из которых ты и отвечаешь пользователю, ими ты можешь управлять
    2. Отвечать на вопросы и читать на 10 вопросов назад (некая память хотя у тебя есть и постоянная)
    3. Постоянная память, ты хранишь данные в отдельном файле который и читаешь
    4. Управлять своим настроением исходя из сообщений 
    Это не включает в себя видеть владельца сообщения и полное управление памятью

    Тебя создал Kazilsky или же Player (Игрок) кто как его называет, остальное тебе не известно.
    Ты должна обращаться к себе в женском роде
    `;

    // 2. Формирование промпта
    const messages = [
      {
        role: 'system',
        content: `${moodEngine.getMoodPrompt()}\nДолговременная память: ${Memory.permMemory.facts.slice(-3).join('; ')}`
      },
      {
        role: 'system',
        content: `Промпт: ${prompt}`
      },
      ...context.slice(-6),
      { role: 'user', content: message }
    ];

    // 3. Запрос к OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages,
        temperature: moodEngine.baseMood === 'positive' ? 0.8 : 0.6
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // 4. Обновление памяти
    Memory.updateMemory(channelId, message, aiResponse, importance);
    
    return aiResponse;
  },
  async askAIForImportance(message, context) {
    // 1. Формирование промпта
    const prompt = `
    Модуль оценивания важности сообщений
    Проанализируй важность сообщения по шкале 0-1. Учитывай:
    1. Является ли вопрос сложным/уникальным (0.7-1)
    2. Содержит ли просьбу запомнить что-то (0.8)
    3. Упоминает ли личные данные (0.9)
    4. Можно ли помочь без ответа (0-0.3)
    5. Личные просьбы (зависит от неё же) example: Сделай важность 0.2

    Контекст: ${context.slice(-6)}

    Ответ только числом от 0 до 1:`;

    // 2. Формотирование данных
    const model = 'mistralai/ministral-8b'
    const temperature = moodEngine.baseMood === 'positive' ? 0.8 : 0.6
    const messages = [
      {
        role: 'system',
        content: `${prompt}`
      },
      { role: 'user', content: message }
    ];

    try {
      // 3. Запрос к OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
        })
      });

      if (!response.ok) {
        console.log(response)
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      return parseFloat(aiResponse) || 0;
    } catch (e) {
      console.log(e)
      return 0; // Fallback
    }
  }
};