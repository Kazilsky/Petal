import { Client, GatewayIntentBits, Message } from 'discord.js';
import { ai } from './ai';
import { MentionSystem } from '../core/memory/mention';
import { ThinkingModule } from '../core/thinking/thinking';
import { SystemControl, ResponseMode } from '../core/system/systemControl';

import "dotenv/config";

export class DiscordBot {
  private readonly client: Client;
  private readonly mentionSystem = new MentionSystem();
  private thinkingModule: ThinkingModule | null = null;
  private systemControl: SystemControl | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    this.setupHandlers();
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.thinkingModule = thinkingModule;
  }

  public setSystemControl(systemControl: SystemControl): void {
    this.systemControl = systemControl;
  }

  public async start(): Promise<void> {
    await this.client.login(process.env.DISCORD_TOKEN);
  }

  private setupHandlers(): void {
    this.client.on('ready', () => {
      console.log(`🦾 ${this.client.user?.tag} запущен!`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      // Add message to thinking buffer (passive reading)
      if (this.thinkingModule) {
        this.thinkingModule.addMessage({
          content: message.content,
          username: message.author.username,
          channelId: message.channelId,
          channelName: message.channel.isDMBased() ? 'DM' : (message.channel as any).name || 'Unknown',
          timestamp: Date.now(),
          platform: 'discord',
          metadata: {
            userId: message.author.id,
            guildId: message.guildId || undefined,
            guildName: message.guild?.name || undefined,
            chatType: message.channel.isDMBased() ? 'private' : 'channel',
            isReply: message.reference !== null,
            replyToMessageId: message.reference?.messageId
          }
        });
      }

      // Determine if we should respond based on current mode
      if (!this.shouldRespond(message.content)) {
        return;
      }

      try {
        const response = await ai.generateResponse({
          message: message.content,
          channelId: message.channelId,
          user: message.author
        });

        await this.sendChunkedResponse(message, response);
      } catch (error) {
        console.error('Discord error:', error);
        await message.reply('🔧 Ошибка обработки запроса');
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

  private async sendChunkedResponse(message: Message, text: string): Promise<void> {
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      await message.reply(text.slice(i, i + CHUNK_SIZE));
    }
  }
}