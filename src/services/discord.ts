import { Client, GatewayIntentBits, Message } from 'discord.js';
import { ai } from './ai';
import { MentionSystem } from '../core/memory/mention';

import "dotenv/config";

export class DiscordBot {
  private readonly client: Client;
  private readonly mentionSystem = new MentionSystem();

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

  public async start(): Promise<void> {
    await this.client.login(process.env.DISCORD_TOKEN);
  }

  private setupHandlers(): void {
    this.client.on('ready', () => {
      console.log(`🦾 ${this.client.user?.tag} запущен!`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot || !this.mentionSystem.isBotMentioned(message.content)) return;

      try {
        const response = await ai.generateResponse({
          message: message.content,
          channelId: message.channelId,
          user: message.author
        });

        // Если модель решила молчать, не отправляем сообщение
        if (response === '[NO_RESPONSE]') {
          console.log(`[SILENCE] Bot chose not to respond to: "${message.content}"`);
          return;
        }

        await this.sendChunkedResponse(message, response);
      } catch (error) {
        console.error('Discord error:', error);
        await message.reply('🔧 Ошибка обработки запроса');
      }
    });
  }

  private async sendChunkedResponse(message: Message, text: string): Promise<void> {
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      await message.reply(text.slice(i, i + CHUNK_SIZE));
    }
  }
}