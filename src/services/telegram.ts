import TelegramBot from 'node-telegram-bot-api';
import { ai } from './ai';
import { MentionSystem } from '../core/memory/mention';
import { ThinkingModule } from '../core/thinking/thinking';
import { SystemControl, ResponseMode } from '../core/system/systemControl';
import "dotenv/config";

export class TelegramService {
  private bot: TelegramBot | null = null;
  private readonly mentionSystem = new MentionSystem();
  private thinkingModule: ThinkingModule | null = null;
  private systemControl: SystemControl | null = null;

  constructor() {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
      console.warn('⚠️ TELEGRAM_TOKEN not set, Telegram service disabled');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.setupHandlers();
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.thinkingModule = thinkingModule;
  }

  public setSystemControl(systemControl: SystemControl): void {
    this.systemControl = systemControl;
  }

  public async start(): Promise<void> {
    if (!this.bot) {
      console.log('❌ Telegram bot not initialized (no token)');
      return;
    }
    console.log('📱 Telegram bot started');
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      if (msg.from?.is_bot) return;

      const chatId = msg.chat.id.toString();
      const username = msg.from?.username || msg.from?.first_name || 'Unknown';
      
      // Determine chat type
      let chatType: 'private' | 'group' | 'channel' | 'supergroup' = 'private';
      if (msg.chat.type === 'group') chatType = 'group';
      if (msg.chat.type === 'supergroup') chatType = 'supergroup';
      if (msg.chat.type === 'channel') chatType = 'channel';

      // Add message to thinking buffer (passive reading)
      if (this.thinkingModule) {
        this.thinkingModule.addMessage({
          content: msg.text,
          username: username,
          channelId: chatId,
          channelName: msg.chat.title || msg.chat.username || username,
          timestamp: Date.now(),
          platform: 'telegram',
          metadata: {
            userId: msg.from?.id.toString(),
            chatType: chatType,
            isReply: msg.reply_to_message !== undefined,
            replyToMessageId: msg.reply_to_message?.message_id.toString()
          }
        });
      }

      // Determine if we should respond based on current mode
      if (!this.shouldRespond(msg.text)) {
        return;
      }

      try {
        const response = await ai.generateResponse({
          message: msg.text,
          channelId: chatId,
          user: { username, id: msg.from?.id.toString() }
        });

        await this.sendChunkedResponse(chatId, response);
      } catch (error) {
        console.error('Telegram error:', error);
        if (this.bot) {
          await this.bot.sendMessage(chatId, '🔧 Ошибка обработки запроса');
        }
      }
    });
  }

  private shouldRespond(messageContent: string): boolean {
    if (!this.systemControl) {
      // Fallback to mention-only mode if system control not available
      return this.mentionSystem.isBotMentioned(messageContent);
    }

    const mode: ResponseMode = this.systemControl.getResponseMode();

    switch (mode) {
      case 'mention_only':
        return this.mentionSystem.isBotMentioned(messageContent);
      
      case 'always_respond':
        return true;
      
      case 'ai_decides':
      default:
        // In AI decides mode, only respond if bot is mentioned
        // AI will decide in prompt whether to give a meaningful response
        return this.mentionSystem.isBotMentioned(messageContent);
    }
  }

  private async sendChunkedResponse(chatId: string, text: string): Promise<void> {
    if (!this.bot) return;

    const CHUNK_SIZE = 4096; // Telegram message limit
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      await this.bot.sendMessage(chatId, text.slice(i, i + CHUNK_SIZE), {
        parse_mode: 'Markdown'
      }).catch(() => {
        // Fallback without markdown if parsing fails
        return this.bot!.sendMessage(chatId, text.slice(i, i + CHUNK_SIZE));
      });
    }
  }
}
