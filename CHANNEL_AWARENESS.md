# Channel Awareness Feature

## Overview

Petal теперь может различать каналы в Discord и Telegram и читать их содержимое независимо. AI может самостоятельно запрашивать список каналов и получать сообщения из конкретных каналов или от конкретных пользователей.

## Что добавлено

### 1. Расширенная структура ChatMessage

```typescript
interface ChatMessage {
  content: string;
  username: string;
  channelId: string;
  channelName?: string;          // НОВОЕ: Название канала
  timestamp: number;
  platform: Platform;
  metadata?: {                   // НОВОЕ: Метаданные
    userId?: string;
    guildId?: string;            // Discord guild ID
    guildName?: string;          // Discord guild name
    chatType?: 'private' | 'group' | 'channel' | 'supergroup';
    isReply?: boolean;
    replyToMessageId?: string;
  };
}
```

### 2. Фильтрация сообщений в ThinkingModule

```typescript
// Получить сообщения с фильтрами
thinkingModule.getRecentMessages(limit, {
  platform: 'discord',     // Фильтр по платформе
  channelId: '123',        // Фильтр по каналу
  username: 'Kazilsky'     // Фильтр по пользователю
});

// Получить список всех активных каналов
const channels = thinkingModule.getChannels();
// Возвращает: [{ platform, channelId, channelName, messageCount }]
```

### 3. Новые AI Actions

#### channels.list
Получить список всех активных каналов:
```typescript
[AI_ACTION:channels.list]{}[/AI_ACTION]
```

Возвращает список каналов с информацией:
- platform (discord/telegram)
- channelId (уникальный ID)
- channelName (читаемое название)
- messageCount (количество сообщений в буфере)

#### messages.getByChannel
Получить сообщения из конкретного канала:
```typescript
[AI_ACTION:messages.getByChannel]{
  "channelId": "discord-general-123",
  "platform": "discord",
  "limit": 20
}[/AI_ACTION]
```

#### messages.getByUser
Получить сообщения от конкретного пользователя:
```typescript
[AI_ACTION:messages.getByUser]{
  "username": "Kazilsky",
  "platform": "telegram",
  "limit": 10
}[/AI_ACTION]
```

## Примеры использования

### Discord: Различные каналы на одном сервере

AI может отличить сообщения из #general от сообщений из #random:

```typescript
// Сообщение в #general
{
  content: "Обсуждаем новый проект",
  username: "Kazilsky",
  channelId: "discord-123",
  channelName: "general",
  platform: "discord",
  metadata: {
    guildId: "guild-1",
    guildName: "My Server",
    chatType: "channel"
  }
}

// Сообщение в #random
{
  content: "Шутка дня",
  username: "User2",
  channelId: "discord-456",
  channelName: "random",
  platform: "discord",
  metadata: {
    guildId: "guild-1",
    guildName: "My Server",
    chatType: "channel"
  }
}
```

AI может запросить: `channels.list` и увидит оба канала отдельно.

### Telegram: Личные сообщения vs группы

AI различает типы чатов:

```typescript
// Личная переписка
{
  content: "Привет!",
  username: "Kazilsky",
  channelId: "tg-123",
  channelName: "Kazilsky",
  platform: "telegram",
  metadata: {
    userId: "tg-user-123",
    chatType: "private"
  }
}

// Сообщение в группе
{
  content: "Всем привет в группе!",
  username: "Kazilsky",
  channelId: "tg-456",
  channelName: "Tech Friends",
  platform: "telegram",
  metadata: {
    userId: "tg-user-123",
    chatType: "group"
  }
}
```

### Кросс-платформенный поиск

AI может найти все сообщения пользователя на всех платформах:

```typescript
[AI_ACTION:messages.getByUser]{"username": "Kazilsky"}[/AI_ACTION]
```

Или только на одной платформе:

```typescript
[AI_ACTION:messages.getByUser]{
  "username": "Kazilsky",
  "platform": "telegram"
}[/AI_ACTION]
```

## Интеграция с сервисами

### Discord Service
Автоматически собирает:
- Название канала (или "DM" для личных сообщений)
- ID и название сервера (guild)
- Тип чата (channel/private)
- Информацию о replies

### Telegram Service
Автоматически собирает:
- Название чата (title, username или имя пользователя)
- Тип чата (private/group/supergroup/channel)
- Информацию о replies

## Преимущества

1. **Контекстное понимание**: AI понимает, из какого канала пришло сообщение
2. **Избирательное чтение**: AI может читать только нужные каналы
3. **Кросс-платформенный поиск**: Поиск по пользователю работает на всех платформах
4. **История по каналам**: AI может анализировать историю конкретного канала
5. **Метрики активности**: AI видит, в каких каналах больше сообщений

## Технические детали

- Все сообщения хранятся в едином буфере ThinkingModule
- Фильтрация происходит в реальном времени при запросе
- Метаданные собираются автоматически при получении сообщения
- Буфер ограничен 100 сообщениями (настраивается)
- Все новые поля опциональны, обратная совместимость сохранена

## Тестирование

Все функции протестированы:
- ✅ Фильтрация по платформе
- ✅ Фильтрация по каналу
- ✅ Фильтрация по пользователю
- ✅ Комбинированные фильтры
- ✅ Получение списка каналов
- ✅ AI actions работают корректно
- ✅ Метаданные собираются правильно
