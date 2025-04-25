// core/ai/actions.ts
import { MemorySystem } from "../memory/memory";

export class AIActionHandler {
  constructor(private readonly memory: MemorySystem) {}

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
    console.log(`[AI NOTE.UNSET] ${params.name} || "Prompt updated"}`);
    return { success: true };
  }
}
