import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { Platform } from "../router/messageRouter";

interface UserIdentity {
  username: string;
  platform: Platform;
  userId: string;
  displayName?: string;
  savedAt: number;
}

export class UserMappingSystem {
  private users: Map<string, UserIdentity> = new Map();
  private readonly USERS_FILE = join(process.cwd(), "user_mapping.json");

  constructor() {
    this.load();
  }

  /**
   * Сохранить связь username → userId
   */
  public saveUser(params: {
    username: string;
    platform: Platform;
    userId: string;
    displayName?: string;
  }): void {
    const key = this.makeKey(params.platform, params.username);
    
    this.users.set(key, {
      username: params.username,
      platform: params.platform,
      userId: params.userId,
      displayName: params.displayName,
      savedAt: Date.now(),
    });

    this.save();
    console.log(`[UserMapping] Saved: ${params.platform}/${params.username} → ${params.userId}`);
  }

  /**
   * Получить userId по username
   */
  public getUserId(platform: Platform, username: string): string | undefined {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const key = this.makeKey(platform, cleanUsername);
    const user = this.users.get(key);
    return user?.userId;
  }

  /**
   * Получить всю информацию о пользователе
   */
  public getUser(platform: Platform, username: string): UserIdentity | undefined {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const key = this.makeKey(platform, cleanUsername);
    return this.users.get(key);
  }

  /**
   * Удалить пользователя
   */
  public removeUser(platform: Platform, username: string): boolean {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const key = this.makeKey(platform, cleanUsername);
    const deleted = this.users.delete(key);
    
    if (deleted) {
      this.save();
      console.log(`[UserMapping] Removed: ${platform}/${cleanUsername}`);
    }
    
    return deleted;
  }

  /**
   * Получить всех пользователей платформы
   */
  public getUsersByPlatform(platform: Platform): UserIdentity[] {
    return Array.from(this.users.values()).filter(u => u.platform === platform);
  }

  /**
   * Список всех пользователей
   */
  public getAllUsers(): UserIdentity[] {
    return Array.from(this.users.values());
  }

  private makeKey(platform: Platform, username: string): string {
    return `${platform}:${username.toLowerCase()}`;
  }

  private save(): void {
    try {
      const data = JSON.stringify(Array.from(this.users.entries()), null, 2);
      writeFileSync(this.USERS_FILE, data, "utf-8");
    } catch (e) {
      console.error("[UserMapping] Save error:", e);
    }
  }

  private load(): void {
    try {
      if (!existsSync(this.USERS_FILE)) {
        console.log("📇 No user_mapping.json found, starting fresh");
        return;
      }

      const data = readFileSync(this.USERS_FILE, "utf-8");
      const entries = JSON.parse(data);
      this.users = new Map(entries);
      console.log(`📇 Loaded ${this.users.size} user mappings`);
    } catch (e) {
      console.error("[UserMapping] Load error:", e);
      this.users = new Map();
    }
  }
}