import { Bot } from 'grammy';
import { ai } from './ai';
import { MentionSystem } from '../core/memory/mention';
import { ThinkingModule } from '../core/thinking/thinking';
import { SystemControl, ResponseMode } from '../core/system/systemControl';
import "dotenv/config";

export class TelegramService {
  private bot: Bot | null = null;
  private readonly mentionSystem = new MentionSystem();
  private thinkingModule: ThinkingModule | null = null;
  private systemControl: SystemControl | null = null;

  constructor() {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
      console.warn('⚠️ TELEGRAM_TOKEN not set, Telegram service disabled');
      return;
    }

    this.bot = new Bot(token);
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
    
    // Start bot in background (grammy handles errors internally mostly)
    this.bot.start({
      onStart: (botInfo) => {
        console.log(`📱 Telegram bot started as @${botInfo.username}`);
      }
    });
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text;
      if (!text) return;
      if (ctx.from?.is_bot) return;

      const chatId = ctx.chat.id.toString();
      const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';
      
      // Determine chat type
      let chatType: 'private' | 'group' | 'channel' | 'supergroup' = 'private';
      const type = ctx.chat.type;
      
      // Cast to string to avoid TypeScript narrowing issues with union types in grammy
      const typeStr = type as string;
      
      if (typeStr === 'group') chatType = 'group';
      else if (typeStr === 'supergroup') chatType = 'supergroup';
      else if (typeStr === 'channel') chatType = 'channel';

      // Add message to thinking buffer (passive reading)
      if (this.thinkingModule) {
        this.thinkingModule.addMessage({
          content: text,
          username: username,
          channelId: chatId,
          channelName: 'title' in ctx.chat ? ctx.chat.title : username,
          timestamp: Date.now(),
          platform: 'telegram',
          metadata: {
            userId: ctx.from?.id.toString(),
            chatType: chatType,
            isReply: ctx.message.reply_to_message !== undefined,
            replyToMessageId: ctx.message.reply_to_message?.message_id.toString()
          }
        });
      }

      // Determine if we should respond based on current mode
      if (!this.shouldRespond(text)) {
        return;
      }

      try {
        const response = await ai.generateResponse({
          message: text,
          channelId: chatId,
          user: { username, id: ctx.from?.id.toString() }
        });

        // If AI decided not to respond (empty string), don't send anything
        if (!response || response.trim() === '') {
          return;
        }

        await this.sendChunkedResponse(chatId, response);
      } catch (error) {
        console.error('Telegram error:', error);
        // Don't reply with error to user to keep immersion
      }
    });
  }

  private shouldRespond(messageContent: string): boolean {
    if (!this.systemControl) {
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
        return true;
    }
  }

  public async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.bot) return;
    try {
      const msg = await this.bot.api.sendMessage(chatId, content);
      
      // Add BOT'S OWN message to thinking buffer
      if (this.thinkingModule && msg) {
        this.thinkingModule.addMessage({
          content: content,
          username: this.bot.botInfo.username || 'Petal',
          channelId: chatId,
          channelName: 'Unknown',
          timestamp: Date.now(),
          platform: 'telegram',
          metadata: {
            userId: this.bot.botInfo.id.toString(),
            isReply: false
          }
        });
      }
    } catch (error) {
      console.error(`Error sending Telegram message to ${chatId}:`, error);
    }
  }

  private async sendChunkedResponse(chatId: string, text: string): Promise<void> {
    if (!this.bot) return;

    const CHUNK_SIZE = 4096; // Telegram message limit
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      const chunk = text.slice(i, i + CHUNK_SIZE);
      try {
        const msg = await this.bot.api.sendMessage(chatId, chunk, {
          parse_mode: 'Markdown'
        });
        
        // Add BOT'S OWN message to thinking buffer
        if (this.thinkingModule && msg) {
          this.thinkingModule.addMessage({
            content: chunk,
            username: this.bot.botInfo.username || 'Petal',
            channelId: chatId,
            channelName: 'Unknown',
            timestamp: Date.now(),
            platform: 'telegram',
            metadata: {
              userId: this.bot.botInfo.id.toString(),
              isReply: false
            }
          });
        }

      } catch (e) {
        // Fallback without markdown if parsing fails
         const msg = await this.bot.api.sendMessage(chatId, chunk);

         // Add BOT'S OWN message to thinking buffer (fallback)
        if (this.thinkingModule && msg) {
          this.thinkingModule.addMessage({
            content: chunk,
            username: this.bot.botInfo.username || 'Petal',
            channelId: chatId,
            channelName: 'Unknown',
            timestamp: Date.now(),
            platform: 'telegram',
            metadata: {
              userId: this.bot.botInfo.id.toString(),
              isReply: false
            }
          });
        }
      }
    }
  }
}
