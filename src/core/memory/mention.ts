export class MentionSystem {
  private readonly mentionPatterns = [
    /петал?/i, // Прямые упоминания (можно добавить варианты имени бота)
  ];

  private readonly questionWords = [
    /кто/i,
    /что/i,
    /где/i,
    /когда/i,
    /почему/i,
    /как/i,
    /какой/i,
    /можно ли/i,
    /существует ли/i,
    /есть ли/i,
    /подскажи(те)?/i,
    /знаешь ли ты/i,
    /помоги(те)?/i,
  ];

  private readonly generalQuestionPatterns = [
    /\?+$/, // Вопросы, заканчивающиеся на "?"
    /^.*\b(как|что|кто|где|почему)\b.*\?*$/i, // Вопросы с вопросительными словами
    /^.*\b(расскажи|объясни|посоветуй|помоги)\b.*/i, // Просьбы
  ];

  private isQuestion(message: string): boolean {
    return (
      this.generalQuestionPatterns.some(pattern => pattern.test(message)) ||
      this.questionWords.some(word => word.test(message))
    );
  }

  private isRequest(message: string): boolean {
    const requestPatterns = [
      /(петал)/i,
      /^(эй|это|слушай),?\s*(петал)/i,
    ];
    return requestPatterns.some(pattern => pattern.test(message));
  }

  public isBotMentioned(message: string): boolean {
    const normalizedMessage = message.trim().toLowerCase();
    
    // Проверка на прямое упоминание
    const isMentioned = this.mentionPatterns.some(pattern => pattern.test(normalizedMessage));
    console.log(isMentioned, this.isQuestion(normalizedMessage), this.isRequest(normalizedMessage))
    
    // if (!isMentioned && this.isQuestion(normalizedMessage)) return true;
    if (!isMentioned) return false;

    // Проверка на вопрос или просьбу
    return (
      this.isQuestion(normalizedMessage) ||
      this.isRequest(normalizedMessage)
    );
  }
}