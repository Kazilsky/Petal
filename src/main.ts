import { DiscordBot } from './services/discord';
import { TelegramService } from './services/telegram';
import { HTTPServer } from './services/server';
import { ThinkingModule } from './core/thinking/thinking';
import { SystemControl } from './core/system/systemControl';
import { Logger } from './core/system/logger';
import { ai } from './services/ai';
import { ThinkingContext } from './core/thinking/thinking';

// Initialize core systems
const logger = new Logger();
const systemControl = new SystemControl(logger);
const thinkingModule = new ThinkingModule(logger);

// Initialize services
const discordBot = new DiscordBot();
const telegramService = new TelegramService();
const httpServer = new HTTPServer();

// Set up thinking callback
thinkingModule.setThinkingCallback(async (context: ThinkingContext) => {
  try {
    // Generate a thinking message based on recent chat activity
    if (context.recentMessages.length === 0) {
      logger.log('debug', 'No recent messages for thinking cycle');
      return;
    }

    logger.log('info', `Thinking cycle: ${context.recentMessages.length} messages in buffer. Analyzing...`);
    
    // Call the AI to think
    const result = await ai.think(context);

    if (result.action === 'SAY' && result.channelId && result.content) {
      logger.log('info', `🧠 Thought Result: Decided to say "${result.content}" in ${result.channelId} (${result.platform})`);
      
      // Dispatch to correct platform
      if (result.platform === 'telegram') {
        await telegramService.sendMessage(result.channelId, result.content);
      } else {
        // Default to Discord
        await discordBot.sendMessage(result.channelId, result.content);
      }
    } else {
      logger.log('debug', '🧠 Thought Result: Decided to stay silent');
    }

  } catch (error) {
    logger.log('error', `Thinking callback error: ${error}`);
  }
});

// Inject dependencies into AI action handler
const actionHandler = (ai as any).actionHandler;
if (actionHandler) {
  actionHandler.setSystemControl(systemControl);
  actionHandler.setThinkingModule(thinkingModule);
}

// Inject dependencies into services
discordBot.setThinkingModule(thinkingModule);
discordBot.setSystemControl(systemControl);

telegramService.setThinkingModule(thinkingModule);
telegramService.setSystemControl(systemControl);

httpServer.setThinkingModule(thinkingModule);
httpServer.setSystemControl(systemControl);

// Start all services
async function startServices() {
  try {
    logger.log('info', '🚀 Starting Petal services...');

    // Start thinking module
    thinkingModule.start();
    logger.log('info', '🧠 Thinking module started');

    // Start Discord bot
    await discordBot.start();

    // Start Telegram bot
    await telegramService.start();

    // Start HTTP server
    await httpServer.start();

    logger.log('info', '✅ All services started successfully');
  } catch (error) {
    logger.log('error', `Fatal error: ${error}`);
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

startServices();
