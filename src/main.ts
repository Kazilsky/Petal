import { DiscordBot } from './services/discord';
import { SocketServer } from './services/socket-server';

const bot = new DiscordBot();
const socketServer = new SocketServer(3000); // Socket.IO сервер на порту 3000

Promise.all([
  bot.start(),
  socketServer.start()
]).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
