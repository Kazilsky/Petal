import fs from 'fs';
import path from 'path';
import { MemoryMessage, PermanentMemory } from '../ai.types';

export class MemorySystem {
  private tempMemory: MemoryMessage[] = [];
  private permMemory: PermanentMemory;
  private additionalPrompt = '';
  private readonly MEMORY_FILE = path.resolve('./perm_memory.json');

  constructor() {
    this.permMemory = this.loadPermanentMemory();
  }

  public getContext(limit = 100): MemoryMessage[] {
    return this.tempMemory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
      .slice(-limit * 2);
  }

  public getAdditionalPrompt(): string {
    return this.additionalPrompt;
  }

  public updatePrompt(newPrompt: string): void {
    this.additionalPrompt += newPrompt;
  }

  public updateMemory(
    channelId: string,
    userMessage: string,
    aiResponse: string,
    importance: number,
    username: string
  ): void {
    this.tempMemory = [
      ...this.tempMemory.slice(-199),
      {
        role: "system",
        content: `Имя пользователя: ${username}, Канал: ${channelId}`
      },
      { role: 'user', content: userMessage, username },
      { role: 'assistant', content: aiResponse }
    ];

    if (importance > 0.65) {
      this.permMemory.facts.push(`${userMessage} → ${aiResponse}`);
      this.savePermanentMemory();
    }
  }

  private loadPermanentMemory(): PermanentMemory {
    try {
      return JSON.parse(fs.readFileSync(this.MEMORY_FILE, 'utf-8'));
    } catch {
      return { keywords: [], facts: [] };
    }
  }

  private savePermanentMemory(): void {
    fs.writeFileSync(this.MEMORY_FILE, JSON.stringify(this.permMemory, null, 2));
  }
}