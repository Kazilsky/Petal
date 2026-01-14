import { router, UnifiedMessage, Platform } from "../router/messageRouter";
import { TriggerSystem } from "./triggers";
import { SkillManager } from "./skills";
import { TaskQueue, Task } from "./taskQueue";
import { ApiNeiro } from "../ai/neiro";

export class AgentBrain {
  private triggers = new TriggerSystem();
  private skills = new SkillManager();
  private tasks = new TaskQueue();
  private ai: ApiNeiro;
  private requestCount = 0;
  private readonly MAX_REQUESTS = 800;

  constructor(ai: ApiNeiro) {
    this.ai = ai;
    this.ai.getActionHandler().setTaskQueue(this.tasks);
    this.setupHandlers();
    this.resetDailyCount();
    this.startScheduledTasksProcessor();
  }

  /**
   * ✅ НОВОЕ: Обработка отложенных задач
   */
  private startScheduledTasksProcessor(): void {
    setInterval(async () => {
      const readyTasks = this.tasks.getScheduledReady();

      for (const task of readyTasks) {
        try {
          await this.executeScheduledTask(task);
        } catch (error) {
          console.error(`[Brain] Scheduled task error [${task.id}]:`, error);
        }
      }
    }, 30 * 1000); // Проверяем каждые 30 секунд
  }

  /**
   * Выполнить отложенную задачу
   */
  private async executeScheduledTask(task: Task): Promise<void> {
    console.log(`⏰ Executing scheduled task [${task.id}]: ${task.type}`);

    switch (task.type) {
      case "remind":
        await this.handleReminder(task);
        break;

      case "delayed_action":
        await this.handleDelayedAction(task);
        break;

      case "multi_step":
        // Для многошаговых задач продолжаем выполнение
        await this.continueMultiStepTask(task);
        break;

      default:
        console.warn(`[Brain] Unknown scheduled task type: ${task.type}`);
    }
  }

  /**
   * Обработка напоминания
   */
  private async handleReminder(task: Task): Promise<void> {
    const reminderText = task.metadata?.reminderText || task.description;

    // Отправляем напоминание
    if (task.target) {
      await router.send({
        platform: task.target.platform,
        target:
          task.target.userId || task.target.channelId || task.source.channelId,
        content: `⏰ ${reminderText}`,
      });
    } else {
      // Если target не указан, отправляем в исходный канал
      await router.send({
        platform: task.source.platform,
        target: task.source.channelId,
        content: `⏰ @${task.source.username}, ${reminderText}`,
      });
    }

    // Завершаем задачу
    this.tasks.complete(task.id, "Напоминание отправлено");
  }

  /**
   * Обработка отложенного действия
   */
  private async handleDelayedAction(task: Task): Promise<void> {
    const action = task.metadata?.action;
    const params = task.metadata?.params;

    if (!action) {
      console.error(`[Brain] Delayed action without action field [${task.id}]`);
      this.tasks.cancel(task.id, "No action specified");
      return;
    }

    try {
      await this.ai.getActionHandler().execute(action, params);
      this.tasks.complete(task.id, `Action ${action} executed`);
    } catch (error: any) {
      console.error(`[Brain] Delayed action failed [${task.id}]:`, error);
      this.tasks.cancel(task.id, error.message);
    }
  }

  /**
   * Продолжение многошаговой задачи
   */
  private async continueMultiStepTask(task: Task): Promise<void> {
    if (!task.metadata?.steps) {
      console.error(`[Brain] Multi-step task without steps [${task.id}]`);
      return;
    }

    const currentStepId = task.metadata.currentStep || 1;
    const currentStep = task.metadata.steps.find(
      (s: any) => s.id === currentStepId,
    );

    if (!currentStep) {
      console.error(`[Brain] Step ${currentStepId} not found [${task.id}]`);
      return;
    }

    // Выполняем текущий шаг
    console.log(
      `📋 Multi-step [${task.id}] executing step ${currentStepId}: ${currentStep.action}`,
    );

    switch (currentStep.action) {
      case "relay_message":
        await this.executeRelayStep(task, currentStep);
        break;

      case "check_status":
        await this.executeCheckStatusStep(task, currentStep);
        break;

      case "custom":
        // Можно расширить под кастомные действия
        await this.executeCustomStep(task, currentStep);
        break;

      default:
        console.warn(`[Brain] Unknown step action: ${currentStep.action}`);
    }
  }

  /**
   * Выполнить шаг "передать сообщение"
   */
  private async executeRelayStep(task: Task, step: any): Promise<void> {
    const target = task.metadata?.relayTarget || step.target;

    if (!target) {
      console.error(`[Brain] Relay step without target [${task.id}]`);
      step.status = "failed";
      return;
    }

    // Берем последний ответ из задачи
    const lastReply = task.replies[task.replies.length - 1];
    const messageToRelay =
      step.message || lastReply?.content || task.description;

    await router.send({
      platform: target.platform,
      target: target.channelId || target.channelName, // Поддержка и ID и имени
      content: messageToRelay,
    });

    step.status = "completed";
    step.result = "Message relayed";

    // Переходим к следующему шагу или завершаем
    this.advanceMultiStepTask(task);
  }

  /**
   * Выполнить шаг "проверка статуса"
   */
  private async executeCheckStatusStep(task: Task, step: any): Promise<void> {
    // Здесь можно добавить логику проверки статуса системы, сервера и т.д.
    step.status = "completed";
    step.result = "Status checked";
    this.advanceMultiStepTask(task);
  }

  /**
   * Выполнить кастомный шаг
   */
  private async executeCustomStep(task: Task, step: any): Promise<void> {
    // Placeholder для будущих расширений
    console.log(
      `[Brain] Custom step [${task.id}/${step.id}]: ${step.description || "no description"}`,
    );
    step.status = "completed";
    this.advanceMultiStepTask(task);
  }

  /**
   * Перейти к следующему шагу или завершить задачу
   */
  private advanceMultiStepTask(task: Task): void {
    const steps = task.metadata!.steps;
    const currentStepId = task.metadata!.currentStep;
    const nextStepId = currentStepId + 1;

    const nextStep = steps.find((s: any) => s.id === nextStepId);

    if (nextStep) {
      // Есть следующий шаг
      task.metadata!.currentStep = nextStepId;
      nextStep.status = "pending";

      // Если следующий шаг требует ожидания - обновляем статус задачи
      if (nextStep.action === "wait_response") {
        task.status = "waiting";
      }

      this.tasks.get(task.id); // Trigger save через getter (или явно вызови save)
      console.log(`📋 Multi-step [${task.id}] advanced to step ${nextStepId}`);
    } else {
      // Больше шагов нет - завершаем
      this.tasks.complete(task.id, "All steps completed");
      console.log(`✅ Multi-step task [${task.id}] completed`);

      // Уведомляем пользователя
      router.send({
        platform: task.source.platform,
        target: task.source.channelId,
        content: `✅ Задача "${task.title}" выполнена!`,
      });
    }
  }

  private setupHandlers(): void {
    router.onMessage(async (msg) => {
      await this.process(msg);
    });
  }

  private async process(msg: UnifiedMessage): Promise<void> {
    // ═══════════════════════════════════════════
    // 1. Создатель отвечает в ТГ - проверяем задачи
    // ═══════════════════════════════════════════
    const ignoredUsers = this.ai.getMemory().getIgnoredUsers();
    if (ignoredUsers.includes(msg.username.toLowerCase())) {
      return; // Молча игнорируем
    }

    if (msg.isCreator && msg.platform === "telegram") {
      const waitingTask = this.tasks.findWaitingFor("telegram", msg.userId);

      if (waitingTask) {
        await this.handleCreatorReply(waitingTask, msg);
        return;
      }
    }

    // ═══════════════════════════════════════════
    // 2. Команды от создателя
    // ═══════════════════════════════════════════
    if (msg.isCreator && msg.content.startsWith("/")) {
      await this.handleCommand(msg);
      return;
    }

    // ═══════════════════════════════════════════
    // 3. Проверяем триггеры
    // ═══════════════════════════════════════════
    const trigger = this.triggers.check(msg);

    if (trigger.triggered) {
      await this.handleTrigger(msg, trigger);
      return;
    }

    // ═══════════════════════════════════════════
    // 4. Проверяем follow-up ("ну что там?")
    // ═══════════════════════════════════════════
    const existingTask = this.tasks.findByChannel(msg.platform, msg.channelId);

    if (existingTask && this.isFollowUp(msg.content)) {
      await this.handleFollowUp(existingTask, msg);
      return;
    }

    // ═══════════════════════════════════════════
    // 5. Обычная обработка через AI
    // ═══════════════════════════════════════════
    if (this.shouldRespond(msg)) {
      await this.generateAIResponse(msg);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // СОЗДАТЕЛЬ ОТВЕТИЛ
  // ═══════════════════════════════════════════════════════════
  private async handleCreatorReply(
    task: Task,
    msg: UnifiedMessage,
  ): Promise<void> {
    console.log(`📨 Creator replied to task [${task.id}]`);

    // Сохраняем ответ
    this.tasks.setCreatorReply(task.id, msg.content);

    // Отправляем ответ в источник
    const waitTime = this.tasks.getWaitingTime(task.id);

    await router.send({
      platform: task.source.platform,
      target: task.source.channelId,
      content: this.formatCreatorReply(task, msg.content, waitTime),
    });

    // Если были follow-up - отвечаем и на них
    for (const followUp of task.followUps.filter((f) => !f.replied)) {
      this.tasks.markFollowUpReplied(task.id, followUp.messageId);
    }

    // Подтверждаем создателю
    await router.send({
      platform: "telegram",
      target: msg.channelId,
      content: `✅ Передала в ${task.source.platform}/${task.source.channelId}`,
    });
  }

  private formatCreatorReply(
    task: Task,
    reply: string,
    waitTime: string,
  ): string {
    // Петал ПРЕДСТАВЛЯЕТ создателя, не говорит от его лица
    const templates = [
      `Создатель ответил: "${reply}" 🌸`,
      `Узнала! ${reply}`,
      `Ответ от Создателя: ${reply} ✨`,
      `${reply}\n\n_— передала от Создателя_`,
    ];

    // Выбираем случайный шаблон
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ═══════════════════════════════════════════════════════════
  // FOLLOW-UP ("ну что там?", "узнала?")
  // ═══════════════════════════════════════════════════════════
  private isFollowUp(content: string): boolean {
    const patterns = [
      /ну\s*(че|что)\s*там/i,
      /узнала\??/i,
      /есть\s*ответ/i,
      /что\s*(сказал|ответил)/i,
      /(и|ну)\s*как\??/i,
      /ответил(и|а)?\??/i,
    ];

    return patterns.some((p) => p.test(content));
  }

  private async handleFollowUp(task: Task, msg: UnifiedMessage): Promise<void> {
    // Добавляем в историю follow-up
    this.tasks.addFollowUp(task.id, {
      messageId: msg.id,
      username: msg.username,
      content: msg.content,
    });

    const waitTime = this.tasks.getWaitingTime(task.id);

    // Если создатель уже ответил
    if (task.creatorReply) {
      await router.send({
        platform: msg.platform,
        target: msg.channelId,
        content: `Да, Создатель ответил: "${task.creatorReply}" 🌸`,
      });
      return;
    }

    // Ещё ждём
    const responses = [
      `Пока тишина... Жду уже ${waitTime} 😔`,
      `Неа, ещё не ответил. Уже ${waitTime} прошло`,
      `Молчит пока. Как ответит — сразу скажу 🌸`,
      `${waitTime} жду... Напишу сразу как узнаю`,
    ];

    await router.send({
      platform: msg.platform,
      target: msg.channelId,
      content: responses[Math.floor(Math.random() * responses.length)],
    });

    // Напоминаем создателю (но не спамим)
    if (task.followUps.length === 1 || task.followUps.length % 3 === 0) {
      await router.sendToCreator(
        `🔔 Напоминаю: ${task.source.username} ждёт ответа уже ${waitTime}\n\n"${task.originalQuestion}"`,
        "telegram",
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ТРИГГЕРЫ
  // ═══════════════════════════════════════════════════════════
  private async handleTrigger(
    msg: UnifiedMessage,
    trigger: any,
  ): Promise<void> {
    switch (trigger.type) {
      case "ask_creator":
        // Создаём долгую задачу
        const taskId = this.tasks.add({
          type: "wait_creator",
          source: {
            platform: msg.platform,
            channelId: msg.channelId,
            messageId: msg.id,
            username: msg.username,
          },
          context: `Вопрос о создателе`,
          originalQuestion: msg.content,
          waitingFor: {
            platform: "telegram",
            userId: process.env.CREATOR_TELEGRAM_ID,
          },
          lifetimeHours: 24, // Живёт сутки
        });

        // Уведомляем создателя
        await router.sendToCreator(
          `👀 **${msg.username}** спрашивает о тебе\n📍 ${msg.platform}/${msg.channelName}\n\n"${msg.content}"\n\n_Просто ответь сюда — я передам_`,
          "telegram",
        );

        // Автоответ
        await router.send({
          platform: msg.platform,
          target: msg.channelId,
          content: "Сейчас узнаю у Создателя, подожди 🌸",
        });
        break;

      case "conflict":
        await router.sendToCreator(
          `⚠️ **Возможный конфликт**\n${msg.username} в ${msg.platform}/${msg.channelName}:\n\n"${msg.content}"`,
          "telegram",
        );
        break;

      case "urgent":
        await router.sendToCreator(
          `🚨 **Срочно!**\n${msg.username}:\n"${msg.content}"`,
          "telegram",
        );
        break;

      case "mention":
        if (this.canUseAI()) {
          await this.generateAIResponse(msg);
        }
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // КОМАНДЫ
  // ═══════════════════════════════════════════════════════════
  private async handleCommand(msg: UnifiedMessage): Promise<void> {
    const [cmd, ...args] = msg.content.slice(1).split(" ");

    switch (cmd) {
      case "status":
        const active = this.tasks.getActive();
        await router.send({
          platform: msg.platform,
          target: msg.channelId,
          content: `📊 **Статус Петал**
🔢 Запросов сегодня: ${this.requestCount}/${this.MAX_REQUESTS}
📋 Активных задач: ${active.length}
📚 Skills: ${this.skills.list().join(", ") || "нет"}`,
        });
        break;

      case "tasks": {
        const tasks = this.tasks.getActive();
        if (tasks.length === 0) {
          await router.send({
            platform: msg.platform,
            target: msg.channelId,
            content: "📋 Нет активных задач",
          });
          break;
        }

        const list = tasks
          .map((t) => {
            const wait = this.tasks.getWaitingTime(t.id);
            const followUps = t.followUps.length;
            return `• [${t.status}] ${t.source.username}: "${t.originalQuestion.slice(0, 40)}..." (${wait}${followUps ? `, ${followUps} напоминаний` : ""})`;
          })
          .join("\n");

        await router.send({
          platform: msg.platform,
          target: msg.channelId,
          content: `📋 **Активные задачи:**\n${list}`,
        });
        break;
      }

      case "say": {
        const [platform, channelId, ...text] = args;
        if (platform && channelId && text.length) {
          await router.send({
            platform: platform as Platform,
            target: channelId,
            content: text.join(" "),
          });
          await router.send({
            platform: msg.platform,
            target: msg.channelId,
            content: "✅ Отправила",
          });
        }
        break;
      }

      case "reply": {
        // /reply task_123 Текст ответа
        const [taskId, ...text] = args;
        const task = this.tasks.get(taskId);

        if (!task) {
          await router.send({
            platform: msg.platform,
            target: msg.channelId,
            content: "❌ Задача не найдена",
          });
          break;
        }

        // Имитируем ответ создателя
        await this.handleCreatorReply(task, {
          ...msg,
          content: text.join(" "),
        });
        break;
      }

      case "skill": {
        const [skillName, actionName] = args;
        if (skillName && actionName) {
          try {
            const result = await this.skills.run(skillName, actionName);
            await router.send({
              platform: msg.platform,
              target: msg.channelId,
              content: `✅ \`\`\`json\n${JSON.stringify(result, null, 2).slice(0, 1000)}\n\`\`\``,
            });
          } catch (e: any) {
            await router.send({
              platform: msg.platform,
              target: msg.channelId,
              content: `❌ ${e.message}`,
            });
          }
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // AI
  // ═══════════════════════════════════════════════════════════
  private async shouldRespond(msg: UnifiedMessage): Promise<boolean> {
    // Создателю - всегда
    if (msg.isCreator) return true;

    // Упоминание бота - всегда
    if (/петал|petal/i.test(msg.content)) return true;

    // ЛС - всегда
    if (msg.isDM) return true;

    // ✅ ИСПОЛЬЗУЕМ QUICKCHECK
    const recentHistory = this.ai.getMemory().getRecentMessages(10);
    const ignoredUsers = this.ai.getMemory().getIgnoredUsers();

    return await this.ai.quickCheck(
      msg.content,
      msg.username,
      recentHistory,
      ignoredUsers,
    );
  }

  private async generateAIResponse(msg: UnifiedMessage): Promise<void> {
    if (!this.canUseAI()) return;

    this.requestCount++;

    try {
      const response = await this.ai.generateResponse({
        message: msg.content,
        channelId: msg.channelId,
        user: { username: msg.username, id: msg.userId },
        platform: msg.platform,
      });

      if (response && !response.includes("[NO_RESPONSE]") && response.trim()) {
        await router.send({
          platform: msg.platform,
          target: msg.channelId,
          content: response,
        });
      }
    } catch (e) {
      console.error("[Brain] AI error:", e);
    }
  }

  private canUseAI(): boolean {
    return this.requestCount < this.MAX_REQUESTS;
  }

  private resetDailyCount(): void {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    setTimeout(() => {
      this.requestCount = 0;
      console.log("[Brain] Daily counter reset");
      this.resetDailyCount();
    }, midnight.getTime() - now.getTime());
  }
}
