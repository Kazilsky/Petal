// main.js
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import { ApiNeiro } from './test.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Устанавливаем статус бота
function setBotStatus(status, type = ActivityType.Playing) {
  client.user?.setActivity({
    name: status,
    type: type
  });
}

client.on('ready', () => {
  console.log(`🤖 ${client.user.tag} готов!`);
  setBotStatus('отвечает на вопросы');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.trim()) return;

  try {
    await message.channel.sendTyping();
    
    // Определяем настроение по префиксу
    let mood = 'neutral';
    if (message.content.startsWith('!friendly')) mood = 'friendly';
    if (message.content.startsWith('!creative')) mood = 'creative';
    
    const question = mood !== 'neutral' 
      ? message.content.split(' ').slice(1).join(' ')
      : message.content;

    const response = await ApiNeiro.test(question, { 
      mood,
      channelId: message.channelId 
    });

    // Отправка ответа с учетом лимита Discord
    const replyContent = response.content;
    for (let i = 0; i < replyContent.length; i += 2000) {
      await message.reply(replyContent.slice(i, i + 2000));
    }

  } catch (error) {
    console.error(error);
    setBotStatus('Ошибка API', ActivityType.Custom);
    await message.reply(error.message);
    
    // Через 5 минут возвращаем нормальный статус
    setTimeout(() => setBotStatus('отвечает на вопросы'), 300000);
  }
});

client.login(process.env.DISCORD_TOKEN);