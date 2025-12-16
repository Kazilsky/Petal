import { MemorySystem } from "../memory/memory";
import { SystemControl } from "../system/systemControl";
import { ThinkingModule } from "../thinking/thinking";

export class AIActionHandler {
  private systemControl: SystemControl | null = null;
  private thinkingModule: ThinkingModule | null = null;

  constructor(private readonly memory: MemorySystem) {}

  public setSystemControl(systemControl: SystemControl): void {
    this.systemControl = systemControl;
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.thinkingModule = thinkingModule;
  }

  public async execute(
    action: string,
    params: any,
  ): Promise<{ success: boolean }> {
    switch (action) {
      case "log":
        return this.handleLog(params);

      // Работа с записями
      case "noteSet":
        return this.handleNoteSet(params);
      case "noteUnset":
        return this.handleNoteUnset(params);
      
      // Ignore list management
      case "ignoreUser":
        return this.handleIgnoreUser(params);
      case "unignoreUser":
        return this.handleUnignoreUser(params);
      
      // Thinking module controls
      case "thinking.enable":
        return this.handleThinkingEnable(params);
      case "thinking.setInterval":
        return this.handleThinkingSetInterval(params);
      case "thinking.status":
        return this.handleThinkingStatus();

      // Response mode controls
      case "mode.set":
        return this.handleModeSet(params);
      case "mode.get":
        return this.handleModeGet();

      // Logging controls
      case "log.setLevel":
        return this.handleLogSetLevel(params);
      case "log.enableFile":
        return this.handleLogEnableFile(params);
      case "log.get":
        return this.handleLogGet(params);
      case "log.clear":
        return this.handleLogClear();

      // System controls
      case "system.status":
        return this.handleSystemStatus();
      case "system.config":
        return this.handleSystemConfig(params);
      case "system.readSource":
        return this.handleSystemReadSource(params);
      case "system.listFiles":
        return this.handleSystemListFiles(params);

      // Channel and message queries
      case "channels.list":
        return this.handleChannelsList();
      case "messages.getByChannel":
        return this.handleMessagesGetByChannel(params);
      case "messages.getByUser":
        return this.handleMessagesGetByUser(params);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private handleLog(params: { message: string }): { success: boolean } {
    console.log(`[AI LOG] ${params.message}`);
    return { success: true };
  }

  private handleNoteSet(params: {
    name: string;
    prompt: string;
    message?: string;
  }): {
    success: boolean;
  } {
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

  private handleUnignoreUser(params: { username: string }): { success: boolean } {
    this.memory.unignoreUser(params.username);
    console.log(`[AI UNIGNORE] Убран из игнора: ${params.username}`);
    return { success: true };
  }

  // Thinking module handlers
  private handleThinkingEnable(params: { enabled: boolean }): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    this.thinkingModule.setEnabled(params.enabled);
    console.log(`[AI THINKING] ${params.enabled ? 'Enabled' : 'Disabled'}`);
    return { success: true };
  }

  private handleThinkingSetInterval(params: { minutes: number }): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    const seconds = params.minutes * 60;
    this.thinkingModule.setInterval(seconds);
    console.log(`[AI THINKING] Interval set to ${params.minutes} minutes`);
    return { success: true };
  }

  private handleThinkingStatus(): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    const status = this.thinkingModule.getStatus();
    console.log(`[AI THINKING STATUS]`, status);
    return { success: true };
  }

  // Mode handlers
  private handleModeSet(params: { mode: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const validModes = ['ai_decides', 'mention_only', 'always_respond'];
    if (!validModes.includes(params.mode)) {
      throw new Error(`Invalid mode: ${params.mode}`);
    }
    this.systemControl.setResponseMode(params.mode as any);
    console.log(`[AI MODE] Set to ${params.mode}`);
    return { success: true };
  }

  private handleModeGet(): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const mode = this.systemControl.getResponseMode();
    console.log(`[AI MODE] Current: ${mode}`);
    return { success: true };
  }

  // Log handlers
  private handleLogSetLevel(params: { level: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const validLevels = ['debug', 'info', 'warn', 'error', 'silent'];
    if (!validLevels.includes(params.level)) {
      throw new Error(`Invalid log level: ${params.level}`);
    }
    this.systemControl.getLogger().setLevel(params.level as any);
    console.log(`[AI LOG] Level set to ${params.level}`);
    return { success: true };
  }

  private handleLogEnableFile(params: { enabled: boolean; path?: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    this.systemControl.getLogger().enableFile(params.enabled, params.path);
    console.log(`[AI LOG] File logging ${params.enabled ? 'enabled' : 'disabled'}`);
    return { success: true };
  }

  private handleLogGet(params: { limit?: number; level?: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const logs = this.systemControl.getLogger().getLogs(params.limit, params.level as any);
    console.log(`[AI LOG] Retrieved ${logs.length} logs`);
    return { success: true };
  }

  private handleLogClear(): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    this.systemControl.getLogger().clear();
    console.log(`[AI LOG] Logs cleared`);
    return { success: true };
  }

  // System handlers
  private handleSystemStatus(): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const status = this.systemControl.getStatus();
    console.log(`[AI SYSTEM STATUS]`, status);
    return { success: true };
  }

  private handleSystemConfig(params?: any): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    if (params) {
      this.systemControl.updateConfig(params);
      console.log(`[AI SYSTEM] Config updated`);
    } else {
      const config = this.systemControl.getConfig();
      console.log(`[AI SYSTEM CONFIG]`, config);
    }
    return { success: true };
  }

  private handleSystemReadSource(params: { path: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const content = this.systemControl.readSourceFile(params.path);
    console.log(`[AI SYSTEM] Read file: ${params.path} (${content.length} bytes)`);
    return { success: true };
  }

  private handleSystemListFiles(params: { dir: string }): { success: boolean } {
    if (!this.systemControl) {
      throw new Error("System control not initialized");
    }
    const files = this.systemControl.listFiles(params.dir);
    console.log(`[AI SYSTEM] Files in ${params.dir}:`, files);
    return { success: true };
  }

  // Channel and message query handlers
  private handleChannelsList(): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    const channels = this.thinkingModule.getChannels();
    console.log(`[AI CHANNELS] Found ${channels.length} channels:`, channels);
    return { success: true };
  }

  private handleMessagesGetByChannel(params: { channelId: string; platform?: string; limit?: number }): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    const messages = this.thinkingModule.getRecentMessages(params.limit || 20, {
      channelId: params.channelId,
      platform: params.platform as any
    });
    console.log(`[AI MESSAGES] Retrieved ${messages.length} messages from channel ${params.channelId}`);
    return { success: true };
  }

  private handleMessagesGetByUser(params: { username: string; platform?: string; limit?: number }): { success: boolean } {
    if (!this.thinkingModule) {
      throw new Error("Thinking module not initialized");
    }
    const messages = this.thinkingModule.getRecentMessages(params.limit || 20, {
      username: params.username,
      platform: params.platform as any
    });
    console.log(`[AI MESSAGES] Retrieved ${messages.length} messages from user ${params.username}`);
    return { success: true };
  }
}
