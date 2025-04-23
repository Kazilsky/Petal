import { MemorySystem } from '../memory/memory';
import { PromptSystem } from './prompts';
import { AIActionHandler } from './actions';
import { AIResponseParams } from '../ai.types';

import "dotenv/config";

export class ApiNeiro {
  private readonly promptSystem: PromptSystem;
  private readonly actionHandler: AIActionHandler;
  private readonly memory: MemorySystem;

  constructor() {
    this.memory = new MemorySystem();
    this.promptSystem = new PromptSystem(this.memory);
    this.actionHandler = new AIActionHandler(this.memory);
  }

  public async generateResponse(params: AIResponseParams): Promise<string> {
    const messages = this.promptSystem.buildMessages(
      params.message,
      params.channelId,
      params.user.username
    );

    const response = await this.queryAI(messages);
    // Заполняем память
    this.memory.updateMemory(params.channelId, params.message, response, 0, params.user.username)
    return this.processResponse(response);
  }

  public async generateDream(): Promise<string> {
    const messages = this.promptSystem.buildMessagesForDream();

    const response = await this.queryDreamAI(messages);
    console.log(response)
    this.memory.updateMemory('null', 'null', response, 0, 'Петал (мысли)')
    return this.processResponse(response);
  }

  private async queryAI(messages: any[]): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        temperature: 0.6
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async queryDreamAI(messages: any[]): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        temperature: 0.6
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0].message.content;
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