import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';

export class SocketServer {
  private io: SocketIOServer;
  private httpServer: ReturnType<typeof createServer>;
  private port: number;

  constructor(port: number = 5002) {
    this.port = port;
    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Обработка входящих запросов от Ukagaka
      socket.on('user:message', async (data: { message: string }, callback) => {
        try {
          console.log(`Message from ${socket.id}: ${data.message}`);

          // Здесь должна быть твоя логика обработки сообщения
          // Например, передача в Discord бот или другую модель
          const response = {
            success: true,
            reply: `Ответ на: "${data.message}"`,
            timestamp: new Date().toISOString()
          };

          // Отправляем ответ обратно Ukagaka
          callback(response);

          // Можно также отправить событие всем клиентам
          this.io.emit('message:processed', {
            clientId: socket.id,
            message: data.message,
            response: response.reply
          });
        } catch (error) {
          console.error('Error processing message:', error);
          callback({
            success: false,
            error: 'Failed to process message'
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`Socket.IO server running on port ${this.port}`);
        resolve();
      });
    });
  }

  public stop(): void {
    this.httpServer.close();
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
