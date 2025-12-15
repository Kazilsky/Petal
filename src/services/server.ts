import express, { Request, Response } from 'express';
import { ai } from './ai';
import { ThinkingModule } from '../core/thinking/thinking';
import { SystemControl } from '../core/system/systemControl';
import "dotenv/config";

export class HTTPServer {
  private app: express.Application;
  private thinkingModule: ThinkingModule | null = null;
  private systemControl: SystemControl | null = null;
  private readonly port: number;
  private readonly apiKey: string | undefined;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.API_PORT || '3000', 10);
    this.apiKey = process.env.API_KEY;

    this.setupMiddleware();
    this.setupRoutes();
  }

  public setThinkingModule(thinkingModule: ThinkingModule): void {
    this.thinkingModule = thinkingModule;
  }

  public setSystemControl(systemControl: SystemControl): void {
    this.systemControl = systemControl;
  }

  public async start(): Promise<void> {
    this.app.listen(this.port, () => {
      console.log(`🌐 HTTP API Server running on http://localhost:${this.port}`);
      if (this.apiKey) {
        console.log('🔐 API key authentication enabled');
      } else {
        console.warn('⚠️  No API_KEY set - server is public!');
      }
    });
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // API key authentication middleware
    this.app.use((req: Request, res: Response, next) => {
      // Skip auth check for health endpoint
      if (req.path === '/health') {
        return next();
      }

      if (this.apiKey) {
        const providedKey = req.headers['x-api-key'] || req.query.api_key;
        if (providedKey !== this.apiKey) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Chat endpoint
    this.app.post('/chat', async (req: Request, res: Response) => {
      try {
        const { message, channelId, username } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        // Add to thinking buffer
        if (this.thinkingModule) {
          this.thinkingModule.addMessage({
            content: message,
            username: username || 'http_user',
            channelId: channelId || 'http',
            timestamp: Date.now(),
            platform: 'http'
          });
        }

        const response = await ai.generateResponse({
          message,
          channelId: channelId || 'http',
          user: { username: username || 'http_user' }
        });

        res.json({ response, timestamp: Date.now() });
      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
      }
    });

    // System status endpoint
    this.app.get('/system/status', (req: Request, res: Response) => {
      if (!this.systemControl) {
        return res.status(503).json({ error: 'System control not initialized' });
      }

      const status = this.systemControl.getStatus();
      res.json(status);
    });

    // System config endpoint
    this.app.get('/system/config', (req: Request, res: Response) => {
      if (!this.systemControl) {
        return res.status(503).json({ error: 'System control not initialized' });
      }

      const config = this.systemControl.getConfig();
      res.json(config);
    });

    this.app.post('/system/config', (req: Request, res: Response) => {
      if (!this.systemControl) {
        return res.status(503).json({ error: 'System control not initialized' });
      }

      try {
        this.systemControl.updateConfig(req.body);
        res.json({ success: true, config: this.systemControl.getConfig() });
      } catch (error) {
        res.status(400).json({ error: String(error) });
      }
    });

    // Thinking module endpoints
    this.app.get('/thinking/status', (req: Request, res: Response) => {
      if (!this.thinkingModule) {
        return res.status(503).json({ error: 'Thinking module not initialized' });
      }

      const status = this.thinkingModule.getStatus();
      res.json(status);
    });

    this.app.post('/thinking/enable', (req: Request, res: Response) => {
      if (!this.thinkingModule) {
        return res.status(503).json({ error: 'Thinking module not initialized' });
      }

      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be boolean' });
      }

      this.thinkingModule.setEnabled(enabled);
      res.json({ success: true, enabled });
    });

    this.app.post('/thinking/interval', (req: Request, res: Response) => {
      if (!this.thinkingModule) {
        return res.status(503).json({ error: 'Thinking module not initialized' });
      }

      const { seconds } = req.body;
      if (typeof seconds !== 'number' || seconds < 10 || seconds > 3600) {
        return res.status(400).json({ 
          error: 'seconds must be a number between 10 and 3600' 
        });
      }

      this.thinkingModule.setInterval(seconds);
      res.json({ success: true, interval: seconds });
    });

    // Logs endpoint
    this.app.get('/logs', (req: Request, res: Response) => {
      if (!this.systemControl) {
        return res.status(503).json({ error: 'System control not initialized' });
      }

      const limitParam = req.query.limit as string | undefined;
      const levelParam = req.query.level as string | undefined;

      // Validate limit parameter
      let limit: number | undefined;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 10000) {
          return res.status(400).json({ 
            error: 'limit must be a number between 1 and 10000' 
          });
        }
        limit = parsedLimit;
      }

      // Validate level parameter
      const validLevels = ['debug', 'info', 'warn', 'error', 'silent'];
      if (levelParam && !validLevels.includes(levelParam)) {
        return res.status(400).json({ 
          error: `level must be one of: ${validLevels.join(', ')}` 
        });
      }

      const logs = this.systemControl.getLogger().getLogs(limit, levelParam as any);
      res.json({ logs, count: logs.length });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }
}
