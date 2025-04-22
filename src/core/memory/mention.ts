// core/memory/mention.ts
export class MentionSystem {
    private readonly mentionPatterns = [
      /петал?/i,
    ];
  
    public isBotMentioned(message: string): boolean {
      return this.mentionPatterns.some(pattern => pattern.test(message));
    }
  }