import { UserMappingSystem } from "../memory/userMapping";
export type Platform = "discord" | "telegram" | "gmail" | "system";

export interface UnifiedMessage {
  id: string;
  platform: Platform;
  channelId: string;
  channelName?: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  isCreator: boolean;
  isDM: boolean;
}

export interface OutgoingMessage {
  platform: Platform;
  target: string;
  content: string;
}

type MessageHandler = (msg: UnifiedMessage) => Promise<void>;
type SendFunction = (msg: OutgoingMessage) => Promise<boolean>;

class MessageRouter {
  private handlers: MessageHandler[] = [];
  private senders = new Map<Platform, SendFunction>();
  private buffer: UnifiedMessage[] = [];
  private readonly MAX_BUFFER = 200;
  private readonly CREATOR_NAMES = ["kazilsky", "player", "игрок"];

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  registerSender(platform: Platform, sender: SendFunction): void {
    this.senders.set(platform, sender);
  }

  async incoming(msg: UnifiedMessage): Promise<void> {
    msg.isCreator = this.CREATOR_NAMES.includes(msg.username.toLowerCase());

    this.userMapping.saveUser({
      username: msg.username,
      platform: msg.platform,
      userId: msg.userId,
    });

    this.buffer.push(msg);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER);
    }

    for (const handler of this.handlers) {
      try {
        await handler(msg);
      } catch (e) {
        console.error("[Router] Handler error:", e);
      }
    }
  }

  async send(msg: OutgoingMessage): Promise<boolean> {
    const sender = this.senders.get(msg.platform);
    if (!sender) {
      console.error(`[Router] No sender for ${msg.platform}`);
      return false;
    }
    return sender(msg);
  }

  async sendToCreator(
    content: string,
    platform: Platform = "telegram",
  ): Promise<boolean> {
    const target =
      platform === "telegram"
        ? process.env.CREATOR_TELEGRAM_ID
        : process.env.CREATOR_DISCORD_ID;

    if (!target) {
      console.error("[Router] No creator ID for", platform);
      return false;
    }

    return this.send({ platform, target, content });
  }

  getRecent(
    limit = 50,
    filter?: { platform?: Platform; channelId?: string },
  ): UnifiedMessage[] {
    let msgs = [...this.buffer];
    if (filter?.platform)
      msgs = msgs.filter((m) => m.platform === filter.platform);
    if (filter?.channelId)
      msgs = msgs.filter((m) => m.channelId === filter.channelId);
    return msgs.slice(-limit);
  }

  getCreatorId(platform: Platform): string | undefined {
    return platform === "telegram"
      ? process.env.CREATOR_TELEGRAM_ID
      : process.env.CREATOR_DISCORD_ID;
  }
}

export const router = new MessageRouter();
