import { DiscordBot } from "./services/discord";
import { TelegramService } from "./services/telegram";
import { AgentBrain } from "./core/agent/brain";
import { ApiNeiro } from "./core/ai/neiro";
import { Logger } from "./core/system/logger";
import { SystemControl } from "./core/system/systemControl";
import { ThinkingModule } from "./core/thinking/thinking";
import { router } from "./core/router/messageRouter";
import "dotenv/config";

async function start() {
  console.log("🚀 Starting Petal...");

  // 1. Logger
  const logger = new Logger();
  logger.setLevel("info");

  // 2. System Control
  const systemControl = new SystemControl(logger);

  // 3. AI
  const ai = new ApiNeiro();

  // 4. Thinking Module
  const thinkingModule = new ThinkingModule(logger);

  // 5. Подключаем зависимости к AI
  ai.setSystemControl(systemControl);
  ai.setThinkingModule(thinkingModule);

  // 6. Brain (теперь с полноценным AI)
  const brain = new AgentBrain(ai);

  // 7. Подписываем thinking module на сообщения
  router.onMessage(async (msg) => {
    thinkingModule.addMessage({
      content: msg.content,
      username: msg.username,
      channelId: msg.channelId,
      channelName: msg.channelName,
      platform: msg.platform,
      timestamp: msg.timestamp,
      metadata: {
        userId: msg.userId,
        isReply: false,
      },
    });
  });

  // 8. Настраиваем thinking cycle (опционально)
  thinkingModule.setThinkingCallback(async (context) => {
    logger.log(
      "debug",
      `Thinking: ${context.recentMessages.length} messages in buffer`,
    );
    // Здесь можно добавить логику периодического анализа чата
  });

  // 9. Запускаем thinking module
  thinkingModule.start();

  // 10. Платформы
  const discord = new DiscordBot();
  const telegram = new TelegramService();

  await discord.start();
  await telegram.start();

  console.log("✅ Petal ready!");
  logger.log("info", "All systems initialized");
}

start().catch(console.error);
