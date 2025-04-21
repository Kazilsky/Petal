import { MemorySystem } from '../memory/memory.js';
import { MoodEngine } from '../memory/mood.js';
// import { assessImportance } from './importance.js';
import { AIActionHandler } from './actions.js';

import "dotenv/config";

const memory = new MemorySystem();
const moodEngine = new MoodEngine();
const actionHandler = new AIActionHandler();

export class ApiNeiro {
  static async generateAIResponse({ message, channelId, user }) {
    // const importance = await assessImportance(message);
    const importance = 0;
    moodEngine.analyzeText(message);
    
    const prompt = this.buildPrompt(channelId, user);
    const messages = this.buildMessages(prompt, message, channelId, user);
    
    const aiResponse = await this.queryAI(messages);

    const processedResponse = await this.processActions(aiResponse);
    
    memory.updateMemory(channelId, message, processedResponse, importance, user.username);
    return processedResponse;
  }

  static buildPrompt() {
    return `
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

    Твоя цель - быть полезным инструментом, а не персонажем. Сохраняй баланс между дружелюбием и профессионализмом, однако я как создатель хочу и искру эмоций.
    
    **Системные команды (используй только когда действительно нужно):**
    Для выполнения действий используй специальный формат:
    [AI_ACTION:action_name]{"param1":"value1","param2":"value2"}[/AI_ACTION]

    Доступные действия:
    1. log - Запись в лог
      Параметры: {"message":"текст сообщения"}

    1. file.write - Запись в файл
      Параметры: {"path":"путь_файла","content":"его_содержимое"} -- недействительно, в разработке

    Примеры:
    - "[AI_ACTION:log]{"message":"Пользователь запросил помощь"}[/AI_ACTION]"
    - "[AI_ACTION:file.write]{"path":"data/log.txt","content":"новая запись"}[/AI_ACTION]" -- недействительно, в разработке

    **Важно:**
    1. Используй команды только когда это необходимо для работы
    2. Все параметры должны быть в валидном JSON
    3. Не пытайся выполнять запрещенные действия
    `;
  }

  static buildMessages(prompt, message, channelId, user) {
    return [
      { role: 'system', content: `Главный промпт: ${this.getSystemMessages(prompt, channelId, user)}`},
      { role: 'system', content: `Временная память: ${JSON.stringify(memory.getContext())}` },
      { role: 'user', content: `${user.username}: ${message}` }
    ];
  }

  static getSystemMessages(prompt, channelId, user) {
    return [
        `${prompt} ${channelId} ${user}`
    ]
  }

  static async queryAI(messages) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages, 
        temperature: 0.6,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  static async processActions(response) {
    const actionRegex = /\[AI_ACTION:(\w+)\](.*?)\[\/AI_ACTION\]/gs;
    let modifiedResponse = response;
    
    for (const match of response.matchAll(actionRegex)) {
      try {
        const result = await actionHandler.execute(match[1], JSON.parse(match[2]));
        modifiedResponse = modifiedResponse.replace(match[0], 
          `[${match[1]}: ${result.success ? '✓' : '✗'}]`);
      } catch (e) {
        console.error('Action error:', e);
      }
    }
    
    return modifiedResponse;
  }
}
