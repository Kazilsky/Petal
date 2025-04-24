import { MemorySystem } from '../memory/memory';
import { PromptSystem } from './prompts';
import { AIActionHandler } from './actions';
import { AIResponseParams } from '../ai.types';
import { InferenceClient } from "@huggingface/inference";
import "dotenv/config";

export class ApiNeiro {
  private readonly promptSystem: PromptSystem;
  private readonly actionHandler: AIActionHandler;
  private readonly memory: MemorySystem;
  private readonly hfClient: InferenceClient;

  constructor() {
    this.memory = new MemorySystem();
    this.promptSystem = new PromptSystem(this.memory);
    this.actionHandler = new AIActionHandler(this.memory);
    this.hfClient = new InferenceClient(process.env.HF_API_KEY!);
  }

  public async generateResponse(params: AIResponseParams): Promise<string> {
    const messages = this.promptSystem.buildMessages(
      params.message,
      params.channelId,
      params.user.username
    );

    const response = await this.queryAI(messages);
    this.memory.updateMemory(params.channelId, params.message, response, 0, params.user.username);
    return this.processResponse(response);
  }

  public async generateDream(): Promise<string> {
    const messages = this.promptSystem.buildMessagesForDream();
    const response = await this.queryDreamAI(messages);
    console.log(response);
    this.memory.updateMemory('null', 'null', response, 0, 'Петал (мысли)');
    return this.processResponse(response);
  }

  private async queryAI(messages: any[]): Promise<string> {
    try {
      const response = await this.hfClient.chatCompletion({
        provider: "novita",
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages: this.formatMessages(messages),
        temperature: 0.6,
        max_tokens: 512
      });
      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`HF API Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async queryDreamAI(messages: any[]): Promise<string> {
    try {
      const response = await this.hfClient.chatCompletion({
        provider: "novita",
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages: this.formatMessages(messages),
        temperature: 0.6,
        max_tokens: 512
      });
      return response.choices[0].message.content;
    } catch (error) {
      throw new Error(`HF API Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatMessages(rawMessages: any[]): Array<{role: string, content: string}> {
    return rawMessages.map(msg => ({
      role: msg.role || 'user',
      content: msg.content || msg.message || ''
    }));
  }

  private async processResponse(response: string): Promise<string> {
    const actionRegex = /\[AI_ACTION:(\w+)\](.*?)\[\/AI_ACTION\]/gs;
    let processedResponse = response;

    for (const match of response.matchAll(actionRegex)) {
      try {
        const result = await this.actionHandler.execute(match[1], JSON.parse(match[2]));
        processedResponse = processedResponse.replace(match[0], `[${match[1]}: ${result.success ? '✓' : '✗'}]`);
      } catch (error) {
        console.error('Action processing error:', error);
      }
    }

    return processedResponse;
  }
}