import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { router, UnifiedMessage } from "../core/router/messageRouter";
import "dotenv/config";

export class DiscordBot {
  private client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.setup();
  }

  private setup(): void {
    // Регистрируем отправщик
    router.registerSender("discord", async (msg) => {
      try {
        const channel = await this.client.channels.fetch(msg.target);
        if (channel?.isTextBased()) {
          await (channel as TextChannel).send(msg.content);
          return true;
        }
      } catch (e) {
        console.error("[Discord] Send error:", e);
      }
      return false;
    });

    this.client.on("ready", () => {
      console.log(`🦾 Discord: ${this.client.user?.tag}`);
    });

    this.client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;

      const unified: UnifiedMessage = {
        id: message.id,
        platform: "discord",
        channelId: message.channelId,
        channelName: message.channel.isDMBased()
          ? "DM"
          : (message.channel as any).name,
        userId: message.author.id,
        username: message.author.username,
        content: message.content,
        timestamp: Date.now(),
        isCreator: false,
        isDM: message.channel.isDMBased(),
      };

      await router.incoming(unified);
    });
  }

  async start(): Promise<void> {
    await this.client.login(process.env.DISCORD_TOKEN);
  }
}
