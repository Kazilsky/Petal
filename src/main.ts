import { DiscordBot } from './services/discord';

const bot = new DiscordBot();
bot.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});