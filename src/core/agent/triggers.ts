import { UnifiedMessage } from "../router/messageRouter";

export interface TriggerResult {
  triggered: boolean;
  type?: "ask_creator" | "conflict" | "urgent" | "mention";
}

export class TriggerSystem {
  check(msg: UnifiedMessage): TriggerResult {
    const content = msg.content.toLowerCase();

    // Прямое упоминание бота - обрабатывается, но не здесь
    if (/петал|petal|@petal/i.test(msg.content)) {
      return { triggered: true, type: "mention" };
    }

    // Спрашивают про создателя
    if (
      /где\s+(игрок|kazilsky|player|создатель)/i.test(content) ||
      /(игрок|kazilsky|создатель)\s+(тут|здесь|онлайн|есть|будет)/i.test(
        content,
      ) ||
      /когда\s+(будет|придет|вернется)\s+(игрок|kazilsky|создатель)/i.test(
        content,
      )
    ) {
      return { triggered: true, type: "ask_creator" };
    }

    // Конфликт
    if (/(дурак|идиот|мудак|сука|пошел\s*на|бан\b|кик\b)/i.test(content)) {
      return { triggered: true, type: "conflict" };
    }

    // Срочное
    if (/(срочно|помогите|sos|urgent|asap)/i.test(content)) {
      return { triggered: true, type: "urgent" };
    }

    return { triggered: false };
  }
}
