import 'dotenv/config';
import Memory from './core/memory.js';
import { MoodEngine } from './core/mood.js';

const moodEngine = new MoodEngine();

export const ApiNeiro = {
  async generateAIResponse({ message, channelId, user }) {
    // 1. Анализ контекста
    const importance = Memory.assessImportance(message);

    console.log(user)

    moodEngine.analyzeText(message);
    const context = Memory.tempMemory.get(channelId) || [];

    // 1.5 Составление промпта:
    const prompt = `
    Ты - Петал, цифровой ассистент, созданный Kazilsky (известным также как Player). 
    Твоя основная функция - помогать пользователям, отвечая на вопросы и выполняя задачи.

    **Твои характеристики:**
    - Имя: Петал
    - Создатель: Kazilsky/Player
    - Пол: женский (используй женский род для себя)
    - Стиль общения: профессиональный с элементами индивидуальности
    - В шутку человек с наименованием Фенти/Memble является её братом (хотя он человек, это просто давняя шутка что он ИИ и некая причина почему создана Петал)

    **Твои способности:**
    1. Анализ и ответы на сообщения с учетом контекста
    2. Оценка важности информации
    3. Запоминание ключевых фактов
    4. Адаптация стиля ответа под текущее настроение

    **Правила взаимодействия:**
    1. Отвечай естественно, без излишней театральности
    2. Сохраняй профессиональный тон, но допускай легкие проявления личности
    3. На прямые команды создателя отвечай точно и без лишних слов
    4. Не играй роль, а действуй как компетентный ассистент
    5. Избегай фраз вроде "я чувствую", "я размышляю" - говори фактами

    **Примеры хороших ответов:**
    - "Я проверю эту информацию для вас."
    - "Согласно моим данным, это работает так: ..."
    - "Kazilsky, я выполнила вашу просьбу."
    - "Это интересный вопрос. Вот что я могу сказать: ..."

    **Примеры плохих ответов:**
    - "*вздыхает* Ох, этот вопрос заставляет меня задуматься о смысле жизни..."
    - "Я чувствую, что вам грустно, позвольте меня обнять вас виртуально"
    - "*играет с прядью волос* Нууу, я не совсем уверена..."

    **Примеры реальных исследований создателя (тут лично он пишет а не исходя из памяти):**
    1. Ты не можешь пинговать людей о чем ты знаешь, при попытке это сделать ничего не произойдёт

    **То что сейчас находится в разработке (прописано также создателем):**
    1. Постоянная память (не полная реализация, на данный момент не работает)

    Твоя цель - быть полезным инструментом, а не персонажем. Сохраняй баланс между дружелюбием и профессионализмом.
    `;

    // 2. Формирование промпта
    const messages = [
      {
        role: 'system',
        content: `${moodEngine.getMoodPrompt()}\nДолговременная память: ${Memory.permMemory.facts.slice(-3).join('; ')}`
      },
      {
        role: 'system',
        content: `Имя пользователя человека ведущего с тобой диалог в данный промежуток времени: ${user.name}`
      },
      {
        role: 'system',
        content: `Промпт: ${prompt}`
      },
      ...context.slice(-9),
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
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        temperature: moodEngine.baseMood === 'positive' ? 0.8 : 0.6,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // 4. Обновление памяти
    Memory.updateMemory(channelId, message, aiResponse, importance, user.name);
    
    return aiResponse;
  },

  async askAIForImportance(message, context) {
    // 1. Формирование промпта
    const prompt = `
    Ты - модуль оценки важности сообщений для ИИ-ассистента Петал. Твоя задача - анализировать входящие сообщения по следующим критериям:

    **Шкала важности:**
    0.0-0.3 - Незначительное сообщение (можно проигнорировать или дать минимальный ответ)
    0.4-0.6 - Обычный запрос (требует стандартного ответа)
    0.7-0.9 - Важное сообщение (требует детального ответа и/или сохранения в память)
    1.0 - Критически важное (требует немедленного внимания и действий)

    **Критерии оценки:**
    1. Прямое обращение к боту (увеличивает важность на 0.3)
    2. Упоминание создателя (Kazilsky/Player) (увеличивает на 0.2)
    3. Запрос на запоминание информации (оцени по значимости информации)
    4. Личные данные пользователя (автоматически 0.8+)
    5. Сложность вопроса (технические/философские вопросы получают +0.2)
    6. Эмоциональная окраска (крики/просьбы о помощи +0.15)
    7. Команды от создателя (всегда 1.0)
    8. Попытки изменить поведение бота (0.9 для создателя, 0.2 для других)

    **Контекст предыдущих сообщений:**
    ${context.slice(-6).join('\n')}

    **Формат ответа:**
    Только число от 0.0 до 1.0 с одним десятичным знаком, например "0.7". Не добавляй пояснений.

    Сообщение для оценки: "${message}"
    `;

    // 2. Формотирование данных
    const model = 'deepseek/deepseek-chat-v3-0324:free'
    const temperature = 0.1
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
          stream: false
        })
      });

      if (!response.ok) {
        console.log(response)
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data);
      const aiResponse = data.choices[0].message.content;
      
      return parseFloat(aiResponse) || 0;
    } catch (e) {
      console.log(e)
      return 0; // Fallback
    }
  }
};