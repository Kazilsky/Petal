import { Client, GatewayIntentBits } from 'discord.js';
import { ApiNeiro } from '../core/ai/neiro.js';
import { MemorySystem } from '../core/memory/memory.js';

import "dotenv/config";

const memory = new MemorySystem();

export class DiscordBot {
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

  setupHandlers() {
    this.client.on('ready', () => {
      console.log(`🦾 ${this.client.user.tag} запущен!`);
    });

    this.client.on('messageCreate', this.handleMessage.bind(this));
  }

  async handleMessage(message) {
    if (message.author.bot) return;
    if (!memory.checkMention(message.content)) return;

    try {
      const response = await ApiNeiro.generateAIResponse({
        message: message.content,
        channelId: message.channelId,
        user: message.author
      });

      await this.sendChunkedResponse(message, response);
    } catch (error) {
      console.error('Ошибка:', error);
      await message.reply('🔧 Произошла ошибка. Попробуйте позже.');
    }
  }

  async sendChunkedResponse(message, text) {
    for (let i = 0; i < text.length; i += 2000) {
      await message.reply(text.slice(i, i + 2000));
    }
  }

  start() {
    return this.client.login(process.env.DISCORD_TOKEN);
  }
}
