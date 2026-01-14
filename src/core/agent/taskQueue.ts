import { Platform } from "../router/messageRouter";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export type TaskStatus =
  | "pending"
  | "waiting"
  | "following_up"
  | "completed"
  | "expired"
  | "cancelled";

export type TaskType =
  | "ask_creator" // Вопрос к создателю
  | "relay_message" // Передать сообщение
  | "remind" // Напоминание
  | "wait_response" // Ожидание ответа от юзера
  | "delayed_action" // Отложенное действие
  | "multi_step"; // Многошаговая задача

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;

  // Откуда пришёл запрос
  source: {
    platform: Platform;
    channelId: string;
    channelName?: string;
    messageId: string;
    username: string;
    userId?: string;
  };

  // Кому адресована задача (если есть)
  target?: {
    platform: Platform;
    channelId?: string;
    userId?: string;
    username?: string;
  };

  // Суть задачи
  title: string; // Краткое название
  description: string; // Полное описание
  originalQuestion: string; // Исходное сообщение

  // Ожидание ответа
  waitingFor?: {
    platform: Platform;
    userId?: string;
    username?: string;
  };

  // История follow-up сообщений
  followUps: Array<{
    messageId: string;
    username: string;
    content: string;
    timestamp: number;
    replied: boolean;
  }>;

  // Ответы и результаты
  replies: Array<{
    from: string;
    content: string;
    timestamp: number;
    platform: Platform;
  }>;

  // Метаданные
  metadata?: Record<string, any>;

  // Временные метки
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  scheduledFor?: number; // Для отложенных задач
}

export interface CreateTaskParams {
  type: TaskType;
  source: Task["source"];
  title: string;
  description: string;
  originalQuestion: string;
  target?: Task["target"];
  waitingFor?: Task["waitingFor"];
  priority?: TaskPriority;
  lifetimeHours?: number;
  scheduledFor?: number;
  metadata?: Record<string, any>;
}

export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private readonly TASK_LIFETIME = 24 * 60 * 60 * 1000; // 24 часа
  private readonly CLEANUP_INTERVAL = 60 * 1000; // Каждую минуту
  private readonly TASKS_FILE = join(process.cwd(), "tasks.json");

  constructor() {
    this.load();
    this.startCleanup();
  }

  /**
   * Создать новую задачу
   */
  add(params: CreateTaskParams): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const lifetime = (params.lifetimeHours || 24) * 60 * 60 * 1000;

    const task: Task = {
      id,
      type: params.type,
      status: params.scheduledFor ? "pending" : "waiting",
      priority: params.priority || "normal",
      source: params.source,
      target: params.target,
      title: params.title,
      description: params.description,
      originalQuestion: params.originalQuestion,
      waitingFor: params.waitingFor,
      followUps: [],
      replies: [],
      metadata: params.metadata,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + lifetime,
      scheduledFor: params.scheduledFor,
    };

    this.tasks.set(id, task);
    this.save();

    console.log(
      `📋 Task created: [${id}] ${params.type} (${params.priority}) - "${params.title}"`,
    );
    return id;
  }

  /**
   * Найти задачу по каналу (для follow-up)
   */
  findByChannel(
    platform: Platform,
    channelId: string,
    activeOnly = true,
  ): Task[] {
    const results: Task[] = [];
    for (const task of this.tasks.values()) {
      if (
        activeOnly &&
        (task.status === "completed" || task.status === "expired")
      ) {
        continue;
      }
      if (
        task.source.platform === platform &&
        task.source.channelId === channelId
      ) {
        results.push(task);
      }
    }
    return results.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  /**
   * Найти задачу, ожидающую ответа от конкретного пользователя
   */
  findWaitingFor(
    platform: Platform,
    userId?: string,
    username?: string,
  ): Task | undefined {
    for (const task of this.tasks.values()) {
      if (task.status !== "waiting" && task.status !== "following_up") continue;
      if (!task.waitingFor) continue;
      if (task.waitingFor.platform !== platform) continue;

      // Проверяем по ID или username
      if (
        userId &&
        task.waitingFor.userId &&
        task.waitingFor.userId === userId
      ) {
        return task;
      }
      if (
        username &&
        task.waitingFor.username?.toLowerCase() === username.toLowerCase()
      ) {
        return task;
      }
      // Если в задаче не указан конкретный пользователь
      if (!task.waitingFor.userId && !task.waitingFor.username) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Добавить follow-up
   */
  addFollowUp(
    taskId: string,
    msg: {
      messageId: string;
      username: string;
      content: string;
    },
  ): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.followUps.push({
      ...msg,
      timestamp: Date.now(),
      replied: false,
    });
    task.lastActivityAt = Date.now();
    task.status = "following_up";

    this.save();
    console.log(
      `📋 Follow-up added to [${taskId}]: "${msg.content.slice(0, 30)}"`,
    );
    return true;
  }

  /**
   * Добавить ответ к задаче
   */
  addReply(
    taskId: string,
    reply: {
      from: string;
      content: string;
      platform: Platform;
    },
  ): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.replies.push({
      ...reply,
      timestamp: Date.now(),
    });
    task.lastActivityAt = Date.now();

    this.save();
    console.log(`💬 Reply added to [${taskId}] from ${reply.from}`);
    return true;
  }

  /**
   * Завершить задачу
   */
  complete(taskId: string, finalReply?: string): Task | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    if (finalReply) {
      task.replies.push({
        from: "system",
        content: finalReply,
        timestamp: Date.now(),
        platform: task.source.platform,
      });
    }

    task.status = "completed";
    task.lastActivityAt = Date.now();

    this.save();
    console.log(`✅ Task [${taskId}] completed`);
    return task;
  }

  /**
   * Отменить задачу
   */
  cancel(taskId: string, reason?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = "cancelled";
    task.lastActivityAt = Date.now();
    if (reason && task.metadata) {
      task.metadata.cancelReason = reason;
    }

    this.save();
    console.log(`❌ Task [${taskId}] cancelled: ${reason || "no reason"}`);
    return true;
  }

  /**
   * Отметить follow-up как отвеченный
   */
  markFollowUpReplied(taskId: string, messageId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const followUp = task.followUps.find((f) => f.messageId === messageId);
    if (!followUp) return false;

    followUp.replied = true;
    this.save();
    return true;
  }

  /**
   * Получить задачи по фильтрам
   */
  getTasks(filter?: {
    status?: TaskStatus | TaskStatus[];
    type?: TaskType | TaskType[];
    priority?: TaskPriority | TaskPriority[];
    platform?: Platform;
    username?: string;
  }): Task[] {
    let results = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status)
          ? filter.status
          : [filter.status];
        results = results.filter((t) => statuses.includes(t.status));
      }
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        results = results.filter((t) => types.includes(t.type));
      }
      if (filter.priority) {
        const priorities = Array.isArray(filter.priority)
          ? filter.priority
          : [filter.priority];
        results = results.filter((t) => priorities.includes(t.priority));
      }
      if (filter.platform) {
        results = results.filter((t) => t.source.platform === filter.platform);
      }
      if (filter.username) {
        results = results.filter(
          (t) =>
            t.source.username.toLowerCase() === filter.username!.toLowerCase(),
        );
      }
    }

    return results.sort((a, b) => {
      // Сначала по приоритету
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Потом по активности
      return b.lastActivityAt - a.lastActivityAt;
    });
  }

  /**
   * Получить активные задачи
   */
  getActive(): Task[] {
    return this.getTasks({
      status: ["pending", "waiting", "following_up"],
    });
  }

  /**
   * Получить задачи с неотвеченными follow-up
   */
  getWithPendingFollowUps(): Task[] {
    return Array.from(this.tasks.values()).filter((t) =>
      t.followUps.some((f) => !f.replied),
    );
  }

  /**
   * Получить отложенные задачи, готовые к выполнению
   */
  getScheduledReady(): Task[] {
    const now = Date.now();
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "pending" && t.scheduledFor && t.scheduledFor <= now,
    );
  }

  /**
   * Сколько времени прошло
   */
  getWaitingTime(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) return "";

    const minutes = Math.floor((Date.now() - task.createdAt) / 60000);

    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч`;

    const days = Math.floor(hours / 24);
    return `${days} дн`;
  }

  /**
   * Получить задачу по ID
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Получить статистику
   */
  getStats(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
    byPriority: Record<TaskPriority, number>;
  } {
    const stats = {
      total: this.tasks.size,
      byStatus: {} as Record<TaskStatus, number>,
      byType: {} as Record<TaskType, number>,
      byPriority: {} as Record<TaskPriority, number>,
    };

    for (const task of this.tasks.values()) {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
      stats.byPriority[task.priority] =
        (stats.byPriority[task.priority] || 0) + 1;
    }

    return stats;
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let changed = false;

      for (const [id, task] of this.tasks) {
        // Истёк срок
        if (
          task.status !== "completed" &&
          task.status !== "cancelled" &&
          now > task.expiresAt
        ) {
          task.status = "expired";
          changed = true;
          console.log(`⏰ Task expired: [${id}] "${task.title}"`);
        }

        // Удаляем старые завершённые задачи
        if (
          (task.status === "completed" ||
            task.status === "cancelled" ||
            task.status === "expired") &&
          now - task.lastActivityAt > 7 * 24 * 60 * 60 * 1000 // 7 дней
        ) {
          this.tasks.delete(id);
          changed = true;
        }
      }

      if (changed) {
        this.save();
      }
    }, this.CLEANUP_INTERVAL);
  }

  private save(): void {
    try {
      const data = JSON.stringify(Array.from(this.tasks.entries()), null, 2);
      writeFileSync(this.TASKS_FILE, data, "utf-8");
    } catch (e) {
      console.error("[TaskQueue] Save error:", e);
    }
  }

  private load(): void {
    try {
      if (!existsSync(this.TASKS_FILE)) {
        console.log("📋 No tasks.json found, starting fresh");
        return;
      }

      const data = readFileSync(this.TASKS_FILE, "utf-8");
      const entries = JSON.parse(data);
      this.tasks = new Map(entries);
      console.log(`📋 Loaded ${this.tasks.size} tasks from disk`);
    } catch (e) {
      console.error("[TaskQueue] Load error:", e);
      this.tasks = new Map();
    }
  }
}
