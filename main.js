import { Client, GatewayIntentBits } from 'discord.js';
import { ApiNeiro } from './AI.js';
import Memory from './core/memory.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`🦾 Бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!Memory.checkMention(message.content)) {
    return; // Игнорируем неважные сообщения без упоминания
  }

  try {
    const response = await ApiNeiro.generateAIResponse({
      message: message.content,
      channelId: message.channelId,
      user: message.author
    });

    // Разбивка длинных сообщений
    for (let i = 0; i < response.length; i += 2000) {
      await message.reply(response.slice(i, i + 2000));
    }
  } catch (error) {
    console.error('Ошибка:', error);
    await message.reply('🔧 Произошла ошибка. Попробуйте позже.');
  }
});

client.login(process.env.DISCORD_TOKEN);