// core/ai/actions.ts
import { MemorySystem } from "../memory/memory";
import { ThinkingModule } from "./thinking";

export class AIActionHandler {
  constructor(
    private readonly memory: MemorySystem,
    private readonly thinking?: ThinkingModule
  ) {}

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
      
      // Управление режимом мышления
      case "dream.on":
        return this.handleDreamOn();
      case "dream.off":
        return this.handleDreamOff();
        
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

  private handleDreamOn(): { success: boolean } {
    if (this.thinking) {
      this.thinking.enable();
      console.log('[AI ACTION] Dream mode enabled');
      return { success: true };
    }
    console.log('[AI ACTION] Dream mode not available (thinking module not initialized)');
    return { success: false };
  }

  private handleDreamOff(): { success: boolean } {
    if (this.thinking) {
      this.thinking.disable();
      console.log('[AI ACTION] Dream mode disabled');
      return { success: true };
    }
    console.log('[AI ACTION] Dream mode not available (thinking module not initialized)');
    return { success: false };
  }
}
