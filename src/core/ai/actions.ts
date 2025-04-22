// core/ai/actions.ts
import { MemorySystem } from '../memory/memory';

export class AIActionHandler {
  constructor(private readonly memory: MemorySystem) {}

  public async execute(action: string, params: any): Promise<{ success: boolean }> {
    switch (action) {
      case 'log':
        return this.handleLog(params);
      case 'addPrompt':
        return this.handleAddPrompt(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private handleLog(params: { message: string }): { success: boolean } {
    console.log(`[AI LOG] ${params.message}`);
    return { success: true };
  }

  private handleAddPrompt(params: { prompt: string; message?: string }): { success: boolean } {
    this.memory.updatePrompt(params.prompt);
    console.log(`[AI PROMPT] ${params.message || 'Prompt updated'}`);
    return { success: true };
  }
}