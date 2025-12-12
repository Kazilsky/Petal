# Petal - Enhanced AI Assistant

## Overview

Petal is an advanced AI assistant with thinking capabilities, multi-platform support, and comprehensive system control.

## Features

### 🧠 Thinking Module
- Configurable interval-based thinking (10 seconds - 1 hour)
- Passive reading of all chat messages
- Automatic message buffer management
- Can be enabled/disabled via AI commands

### 🎯 Response Modes
- **ai_decides** (default) - AI autonomously decides when to respond
- **mention_only** - Only responds when mentioned (regex: `/петал?/i`)
- **always_respond** - Responds to all messages

### 🌐 Multi-Platform Support
- **Discord** - Full Discord bot with passive reading
- **Telegram** - Telegram bot (optional, requires `TELEGRAM_TOKEN`)
- **HTTP API** - REST API server for external integrations

### 🔧 System Control
AI can control its own behavior through actions:

#### Thinking Module Control
```
thinking.enable {"enabled": true|false}
thinking.setInterval {"minutes": 5}
thinking.status
```

#### Response Mode Control
```
mode.set {"mode": "ai_decides|mention_only|always_respond"}
mode.get
```

#### Logging Control
```
log {"message": "text"}
log.setLevel {"level": "debug|info|warn|error|silent"}
log.enableFile {"enabled": true, "path": "./logs.txt"}
log.get {"limit": 50, "level": "error"}
log.clear
```

#### System Introspection
```
system.status
system.config
system.readSource {"path": "core/ai/neiro.ts"}
system.listFiles {"dir": "core"}
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional
TELEGRAM_TOKEN=your_telegram_bot_token
API_PORT=3000
API_KEY=optional_api_key_for_server
```

## Installation

```bash
npm install
```

## Running

```bash
npx tsx src/main.ts
```

## HTTP API Endpoints

### Chat
```bash
POST /chat
{
  "message": "Hello!",
  "username": "user",
  "channelId": "channel123"
}
```

### System Status
```bash
GET /system/status
GET /system/config
POST /system/config
```

### Thinking Module
```bash
GET /thinking/status
POST /thinking/enable
POST /thinking/interval
```

### Logs
```bash
GET /logs?limit=50&level=error
```

## Configuration

Configuration is stored in `system_config.json` and includes:
- Response mode
- Thinking module settings
- Log level and file settings

## Security

- Path traversal protection for file operations
- Only `src/` directory accessible for code introspection
- Optional API key authentication for HTTP server
- Input validation on all HTTP endpoints

## Notes

- `node-telegram-bot-api` has vulnerabilities in deprecated dependencies (request, form-data)
- Telegram service is optional and disabled if no token is provided
- Thinking module runs independently of message responses
- All logs are stored in memory (max 1000 entries) and optionally in file
