import { DiscordBot } from './services/discord.js';

const bot = new DiscordBot();
bot.start().catch(console.error);
