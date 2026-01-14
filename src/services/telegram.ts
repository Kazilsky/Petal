import { Bot, Context } from 'grammy';
import { router, UnifiedMessage } from '../core/router/messageRouter';
import "dotenv/config";

export class TelegramService {
  private bot: Bot | null = null;

  constructor() {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
      console.warn('⚠️ TELEGRAM_TOKEN not set');
      return;
    }

    this.bot = new Bot(token);
    this.setup();
  }

  private setup(): void {
    if (!this.bot) return;

    // Регистрируем отправщик
    router.registerSender('telegram', async (msg) => {
      try {
        await this.bot!.api.sendMessage(msg.target, msg.content, {
          parse_mode: 'Markdown'
        });
        return true;
      } catch {
        try {
          // Fallback без Markdown
          await this.bot!.api.sendMessage(msg.target, msg.content);
          return true;
        } catch (e) {
          console.error('[Telegram] Send error:', e);
          return false;
        }
      }
    });

    // Обработка сообщений
    this.bot.on('message:text', async (ctx: Context) => {
      const msg = ctx.message!;
      
      const unified: UnifiedMessage = {
        id: msg.message_id.toString(),
        platform: 'telegram',
        channelId: msg.chat.id.toString(),
        channelName: 'title' in msg.chat ? msg.chat.title : msg.chat.username || 'DM',
        userId: msg.from?.id.toString() || '',
        username: msg.from?.username || msg.from?.first_name || 'Unknown',
        content: msg.text || '',
        timestamp: Date.now(),
        isCreator: false,
        isDM: msg.chat.type === 'private'
      };

      await router.incoming(unified);
    });

    // Обработка ошибок
    this.bot.catch((err) => {
      console.error('[Telegram] Error:', err);
    });
  }

  async start(): Promise<void> {
    if (!this.bot) return;
    
    // Запускаем long polling
    this.bot.start({
      onStart: () => console.log('📱 Telegram started (grammY)')
    });
  }

  async stop(): Promise<void> {
    await this.bot?.stop();
  }
}