import { MemorySystem } from "../memory/memory";
import { SystemControl } from "../system/systemControl";
import { ThinkingModule } from "../thinking/thinking";
import { TaskQueue, CreateTaskParams } from "../agent/taskQueue";
import { router } from "../router/messageRouter";
import { Platform } from "../router/messageRouter";
import { UserMappingSystem } from "../memory/userMapping";

export class AIActionHandler {
  private systemControl: SystemControl | null = null;
  private thinkingModule: ThinkingModule | null = null;
  private taskQueue: TaskQueue | null = null;
  private userMapping: UserMappingSystem;

  constructor(private readonly memory: MemorySystem) {
    this.userMapping = new UserMappingSystem();
  }

  public setSystemControl(systemControl: SystemControl): void {
    this.systemControl = systemControl;
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.thinkingModule = thinkingModule;
  }

  public setTaskQueue(taskQueue: TaskQueue): void {
    this.taskQueue = taskQueue;
  }

  public async execute(
    action: string,
    params: any,
  ): Promise<{ success: boolean; data?: any }> {
    switch (action) {
      case "log":
        return this.handleLog(params);

      // Memory
      case "noteSet":
        return this.handleNoteSet(params);
      case "noteUnset":
        return this.handleNoteUnset(params);
      case "ignoreUser":
        return this.handleIgnoreUser(params);
      case "unignoreUser":
        return this.handleUnignoreUser(params);

      // Tasks
      case "task.create":
        return this.handleTaskCreate(params);
      case "task.complete":
        return this.handleTaskComplete(params);
      case "task.cancel":
        return this.handleTaskCancel(params);
      case "task.list":
        return this.handleTaskList(params);
      case "task.get":
        return this.handleTaskGet(params);

      // Thinking
      case "thinking.enable":
        return this.handleThinkingEnable(params);
      case "thinking.setInterval":
        return this.handleThinkingSetInterval(params);
      case "thinking.status":
        return this.handleThinkingStatus();

      // System
      case "mode.set":
        return this.handleModeSet(params);
      case "mode.get":
        return this.handleModeGet();
      case "log.setLevel":
        return this.handleLogSetLevel(params);
      case "log.enableFile":
        return this.handleLogEnableFile(params);
      case "log.get":
        return this.handleLogGet(params);
      case "log.clear":
        return this.handleLogClear();
      case "system.status":
        return this.handleSystemStatus();
      case "system.config":
        return this.handleSystemConfig(params);
      case "system.readSource":
        return this.handleSystemReadSource(params);
      case "system.listFiles":
        return this.handleSystemListFiles(params);
      case "channels.list":
        return this.handleChannelsList();
      case "messages.getByChannel":
        return this.handleMessagesGetByChannel(params);
      case "messages.getByUser":
        return this.handleMessagesGetByUser(params);

      // UserMap
      case "user.save":
        return this.handleUserSave(params);
      case "user.get":
        return this.handleUserGet(params);
      case "user.remove":
        return this.handleUserRemove(params);
      case "user.list":
        return this.handleUserList(params);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TASK HANDLERS
  // ═══════════════════════════════════════════════════════════

  private async handleTaskCreate(
    params: CreateTaskParams,
  ): Promise<{ success: boolean; data?: any }> {
    if (!this.taskQueue) {
      throw new Error("TaskQueue not initialized");
    }

    const taskId = this.taskQueue.add(params);

    // ✅ Если задача relay_message — выполняем СРАЗУ
    if (params.type === "relay_message") {
      // Выполняем в фоне, не блокируем ответ AI
      this.executeRelayMessage(taskId, params).catch((err) => {
        console.error(`[AI] relay_message execution failed [${taskId}]:`, err);
      });
    }

    // Если задача для создателя - уведомляем
    else if (params.waitingFor?.platform === "telegram") {
      const priorityEmoji = {
        low: "📝",
        normal: "📋",
        high: "⚠️",
        urgent: "🚨",
      };

      const emoji = priorityEmoji[params.priority || "normal"];

      await router.sendToCreator(
        `${emoji} **Новая задача**\n` +
          `📌 ${params.title}\n` +
          `👤 От: ${params.source.username}\n` +
          `📍 ${params.source.platform}/${params.source.channelName || params.source.channelId}\n\n` +
          `"${params.originalQuestion}"\n\n` +
          `_ID: ${taskId}_\n` +
          `_Ответь сюда — я передам_`,
        "telegram",
      );
    }

    console.log(`[AI TASK.CREATE] ${taskId} (${params.type})`);
    return { success: true, data: { taskId } };
  }

  /**
   * ✅ Выполнить relay_message задачу
   */
  private async executeRelayMessage(
    taskId: string,
    params: CreateTaskParams,
  ): Promise<void> {
    const task = this.taskQueue!.get(taskId);
    if (!task) {
      console.error(`[AI] Task not found: ${taskId}`);
      return;
    }

    const messageText =
      params.metadata?.messageText ||
      params.metadata?.message ||
      params.description;

    if (!params.target) {
      console.error(`[AI] relay_message without target [${taskId}]`);
      this.taskQueue!.cancel(taskId, "No target specified");

      // Сообщаем об ошибке в исходный канал
      await router.send({
        platform: params.source.platform,
        target: params.source.channelId,
        content: `❌ Не могу отправить: не указан получатель`,
      });
      return;
    }

    try {
      let targetId: string | undefined;

      // 1. Пытаемся использовать userId
      if (params.target.userId) {
        targetId = params.target.userId;
      }
      // 2. Или channelId
      else if (params.target.channelId) {
        targetId = params.target.channelId;
      }
      // 3. Или резолвим username
      else if (params.target.username) {
        targetId = await this.resolveUsername(
          params.target.platform,
          params.target.username,
        );
      }

      if (!targetId) {
        throw new Error(
          `Не могу определить получателя: ${JSON.stringify(params.target)}`,
        );
      }

      console.log(
        `[AI] Sending relay message to ${params.target.platform}/${targetId}`,
      );

      // Отправляем сообщение
      const success = await router.send({
        platform: params.target.platform,
        target: targetId,
        content: messageText,
      });

      if (success) {
        this.taskQueue!.complete(taskId, "Message sent");
        console.log(`✅ Relay message sent [${taskId}]`);

        // Подтверждаем отправителю (если это не тот же канал)
        if (
          params.source.platform !== params.target.platform ||
          params.source.channelId !== targetId
        ) {
          await router.send({
            platform: params.source.platform,
            target: params.source.channelId,
            content: `✅ Сообщение отправлено в ${params.target.platform}!`,
          });
        }
      } else {
        throw new Error(
          "router.send вернул false (возможно, платформа не подключена)",
        );
      }
    } catch (error: any) {
      console.error(`[AI] Failed to send relay message [${taskId}]:`, error);
      this.taskQueue!.cancel(taskId, error.message);

      // Сообщаем об ошибке
      await router.send({
        platform: params.source.platform,
        target: params.source.channelId,
        content: `❌ Не удалось отправить: ${error.message}`,
      });
    }
  }

  /**
   * Резолвим username в userId/chatId
   */
  private async resolveUsername(
    platform: Platform,
    username: string,
  ): Promise<string | undefined> {
    const cleanUsername = username.replace(/^@/, "").toLowerCase();

    // 1. Пытаемся найти в user mapping
    const userId = this.userMapping.getUserId(platform, cleanUsername);
    if (userId) {
      console.log(
        `[AI] Resolved ${platform}/${cleanUsername} → ${userId} (from mapping)`,
      );
      return userId;
    }

    // 2. Fallback на переменные окружения для создателя
    if (platform === "telegram") {
      const creatorNames = ["kazilsky", "player", "игрок", "_kazilsky"];
      if (creatorNames.includes(cleanUsername)) {
        const creatorId = process.env.CREATOR_TELEGRAM_ID;
        if (creatorId) {
          console.log(
            `[AI] Resolved ${platform}/${cleanUsername} → ${creatorId} (from env)`,
          );
          return creatorId;
        }
      }
    }

    if (platform === "discord") {
      const creatorNames = ["kazilsky", "_kazilsky", "player", "игрок"];
      if (creatorNames.includes(cleanUsername)) {
        const creatorId = process.env.CREATOR_DISCORD_ID;
        if (creatorId) {
          console.log(
            `[AI] Resolved ${platform}/${cleanUsername} → ${creatorId} (from env)`,
          );
          return creatorId;
        }
      }
    }

    // 3. Не нашли
    throw new Error(
      `Не знаю ID для ${platform}/@${username}. ` +
        `Скажи мне ID через команду или используй [AI_ACTION:user.save]`,
    );
  }

  private async handleTaskComplete(params: {
    taskId: string;
    reply?: string;
  }): Promise<{ success: boolean }> {
    if (!this.taskQueue) {
      throw new Error("TaskQueue not initialized");
    }

    const task = this.taskQueue.complete(params.taskId, params.reply);

    if (!task) {
      throw new Error(`Task not found: ${params.taskId}`);
    }

    console.log(`[AI TASK.COMPLETE] ${params.taskId}`);
    return { success: true };
  }

  private async handleTaskCancel(params: {
    taskId: string;
    reason?: string;
  }): Promise<{ success: boolean }> {
    if (!this.taskQueue) {
      throw new Error("TaskQueue not initialized");
    }

    const success = this.taskQueue.cancel(params.taskId, params.reason);

    if (!success) {
      throw new Error(`Task not found: ${params.taskId}`);
    }

    console.log(
      `[AI TASK.CANCEL] ${params.taskId}: ${params.reason || "no reason"}`,
    );
    return { success: true };
  }

  private async handleTaskList(params?: {
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<{ success: boolean; data?: any }> {
    if (!this.taskQueue) {
      throw new Error("TaskQueue not initialized");
    }

    const tasks = this.taskQueue.getTasks(params as any);
    const stats = this.taskQueue.getStats();

    console.log(`[AI TASK.LIST] Found ${tasks.length} tasks`);
    return {
      success: true,
      data: {
        tasks: tasks.map((t) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          priority: t.priority,
          title: t.title,
          from: t.source.username,
          created: new Date(t.createdAt).toISOString(),
        })),
        stats,
      },
    };
  }

  private async handleTaskGet(params: {
    taskId: string;
  }): Promise<{ success: boolean; data?: any }> {
    if (!this.taskQueue) {
      throw new Error("TaskQueue not initialized");
    }

    const task = this.taskQueue.get(params.taskId);

    if (!task) {
      throw new Error(`Task not found: ${params.taskId}`);
    }

    console.log(`[AI TASK.GET] ${params.taskId}`);
    return { success: true, data: { task } };
  }

  private handleUserSave(params: {
    username: string;
    platform: string;
    userId: string;
    displayName?: string;
  }): { success: boolean } {
    this.userMapping.saveUser({
      username: params.username,
      platform: params.platform as Platform,
      userId: params.userId,
      displayName: params.displayName,
    });

    console.log(
      `[AI USER.SAVE] ${params.platform}/${params.username} → ${params.userId}`,
    );
    return { success: true };
  }

  private handleUserGet(params: { username: string; platform: string }): {
    success: boolean;
    data?: any;
  } {
    const user = this.userMapping.getUser(
      params.platform as Platform,
      params.username,
    );

    if (!user) {
      console.log(
        `[AI USER.GET] Not found: ${params.platform}/${params.username}`,
      );
      return { success: false, data: null };
    }

    console.log(
      `[AI USER.GET] Found: ${params.platform}/${params.username} → ${user.userId}`,
    );
    return { success: true, data: user };
  }

  private handleUserRemove(params: { username: string; platform: string }): {
    success: boolean;
  } {
    const removed = this.userMapping.removeUser(
      params.platform as Platform,
      params.username,
    );
    console.log(
      `[AI USER.REMOVE] ${params.platform}/${params.username}: ${removed ? "removed" : "not found"}`,
    );
    return { success: removed };
  }

  private handleUserList(params?: { platform?: string }): {
    success: boolean;
    data?: any;
  } {
    const users = params?.platform
      ? this.userMapping.getUsersByPlatform(params.platform as Platform)
      : this.userMapping.getAllUsers();

    console.log(`[AI USER.LIST] Found ${users.length} users`);
    return {
      success: true,
      data: {
        users: users.map((u) => ({
          platform: u.platform,
          username: u.username,
          userId: u.userId,
          displayName: u.displayName,
        })),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // OTHER HANDLERS (без изменений)
  // ═══════════════════════════════════════════════════════════

  private handleLog(params: { message: string }): { success: boolean } {
    console.log(`[AI LOG] ${params.message}`);
    return { success: true };
  }

  private handleNoteSet(params: {
    name: string;
    prompt: string;
    message?: string;
  }): { success: boolean } {
    this.memory.setNote(params.name, params.prompt);
    console.log(
      `[AI NOTE.SET] ${params.name}: ${params.message || "Prompt updated"}`,
    );
    return { success: true };
  }

  private handleNoteUnset(params: { name: string }): { success: boolean } {
    this.memory.unsetNote(params.name);
    console.log(`[AI NOTE.UNSET] ${params.name} - Note removed`);
    return { success: true };
  }

  private handleIgnoreUser(params: { username: string }): { success: boolean } {
    this.memory.ignoreUser(params.username);
    console.log(`[AI IGNORE] Добавлен в игнор: ${params.username}`);
    return { success: true };
  }

  private handleUnignoreUser(params: { username: string }): {
    success: boolean;
  } {
    this.memory.unignoreUser(params.username);
    console.log(`[AI UNIGNORE] Убран из игнора: ${params.username}`);
    return { success: true };
  }

  private handleThinkingEnable(params: { enabled: boolean }): {
    success: boolean;
  } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    this.thinkingModule.setEnabled(params.enabled);
    console.log(`[AI THINKING] ${params.enabled ? "Enabled" : "Disabled"}`);
    return { success: true };
  }

  private handleThinkingSetInterval(params: { minutes: number }): {
    success: boolean;
  } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    this.thinkingModule.setInterval(params.minutes * 60);
    console.log(`[AI THINKING] Interval set to ${params.minutes} minutes`);
    return { success: true };
  }

  private handleThinkingStatus(): { success: boolean } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    const status = this.thinkingModule.getStatus();
    console.log(`[AI THINKING STATUS]`, status);
    return { success: true };
  }

  private handleModeSet(params: { mode: string }): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const validModes = ["ai_decides", "mention_only", "always_respond"];
    if (!validModes.includes(params.mode)) {
      throw new Error(`Invalid mode: ${params.mode}`);
    }
    this.systemControl.setResponseMode(params.mode as any);
    console.log(`[AI MODE] Set to ${params.mode}`);
    return { success: true };
  }

  private handleModeGet(): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const mode = this.systemControl.getResponseMode();
    console.log(`[AI MODE] Current: ${mode}`);
    return { success: true };
  }

  private handleLogSetLevel(params: { level: string }): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const validLevels = ["debug", "info", "warn", "error", "silent"];
    if (!validLevels.includes(params.level)) {
      throw new Error(`Invalid log level: ${params.level}`);
    }
    this.systemControl.getLogger().setLevel(params.level as any);
    console.log(`[AI LOG] Level set to ${params.level}`);
    return { success: true };
  }

  private handleLogEnableFile(params: { enabled: boolean; path?: string }): {
    success: boolean;
  } {
    if (!this.systemControl) throw new Error("System control not initialized");
    this.systemControl.getLogger().enableFile(params.enabled, params.path);
    console.log(
      `[AI LOG] File logging ${params.enabled ? "enabled" : "disabled"}`,
    );
    return { success: true };
  }

  private handleLogGet(params: { limit?: number; level?: string }): {
    success: boolean;
  } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const logs = this.systemControl
      .getLogger()
      .getLogs(params.limit, params.level as any);
    console.log(`[AI LOG] Retrieved ${logs.length} logs`);
    return { success: true };
  }

  private handleLogClear(): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    this.systemControl.getLogger().clear();
    console.log(`[AI LOG] Logs cleared`);
    return { success: true };
  }

  private handleSystemStatus(): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const status = this.systemControl.getStatus();
    console.log(`[AI SYSTEM STATUS]`, status);
    return { success: true };
  }

  private handleSystemConfig(params?: any): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    if (params) {
      this.systemControl.updateConfig(params);
      console.log(`[AI SYSTEM] Config updated`);
    } else {
      const config = this.systemControl.getConfig();
      console.log(`[AI SYSTEM CONFIG]`, config);
    }
    return { success: true };
  }

  private handleSystemReadSource(params: { path: string }): {
    success: boolean;
  } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const content = this.systemControl.readSourceFile(params.path);
    console.log(
      `[AI SYSTEM] Read file: ${params.path} (${content.length} bytes)`,
    );
    return { success: true };
  }

  private handleSystemListFiles(params: { dir: string }): { success: boolean } {
    if (!this.systemControl) throw new Error("System control not initialized");
    const files = this.systemControl.listFiles(params.dir);
    console.log(`[AI SYSTEM] Files in ${params.dir}:`, files);
    return { success: true };
  }

  private handleChannelsList(): { success: boolean } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    const channels = this.thinkingModule.getChannels();
    console.log(`[AI CHANNELS] Found ${channels.length} channels:`, channels);
    return { success: true };
  }

  private handleMessagesGetByChannel(params: {
    channelId: string;
    platform?: string;
    limit?: number;
  }): { success: boolean } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    const messages = this.thinkingModule.getRecentMessages(params.limit || 20, {
      channelId: params.channelId,
      platform: params.platform as any,
    });
    console.log(
      `[AI MESSAGES] Retrieved ${messages.length} messages from channel ${params.channelId}`,
    );
    return { success: true };
  }

  private handleMessagesGetByUser(params: {
    username: string;
    platform?: string;
    limit?: number;
  }): { success: boolean } {
    if (!this.thinkingModule)
      throw new Error("Thinking module not initialized");
    const messages = this.thinkingModule.getRecentMessages(params.limit || 20, {
      username: params.username,
      platform: params.platform as any,
    });
    console.log(
      `[AI MESSAGES] Retrieved ${messages.length} messages from user ${params.username}`,
    );
    return { success: true };
  }
}
