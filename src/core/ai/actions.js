import fs from 'fs';
//import { validatePath } from '../../utils/fileManager.js';
import { memory } from './neiro.js'
export class AIActionHandler {
  constructor() {
    this.actions = {
    //   'file.write': this.handleFileWrite.bind(this),
      'log': this.handleLog.bind(this),
      'addPrompt': this.handleAddPrompt.bind(this)
    };
  }

//   async handleFileWrite(params) {
//     try {
//       if (!validatePath(params.path)) {
//         throw new Error('Invalid path');
//       }
//       fs.writeFileSync(params.path, params.content);
//       return { success: true };
//     } catch (error) {
//       return { success: false, error: error.message };
//     }
//   }

  handleAddPrompt(params) {
    try {
      if (params) {
        memory.updatePrompt(params.prompt)
	console.log(`[AI PROMPTER] ${params.message}`) 
      	return { success: true }
      }
    }
    catch (error) {
      return { success: false, error: error.message }
    }
  }

  handleLog(params) {
    console.log(`[AI LOG] ${params.message}`);
    return { success: true };
  }

  async execute(action, params) {
    if (!this.actions[action]) {
      throw new Error(`Unknown action: ${action}`);
    }
    return await this.actions[action](params);
  }
}
