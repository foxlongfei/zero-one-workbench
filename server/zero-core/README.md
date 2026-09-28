# ZERO-CORE Real Chat Gateway V0.1

This directory is the server-side gateway for the real C/Q/D conversation workbench.

## Required server secrets
- OPENAI_API_KEY
- QWEN_API_KEY
- QWEN_BASE_URL
- QWEN_MODEL
- DEEPSEEK_API_KEY
- DEEPSEEK_MODEL (default deepseek-flash)

Never expose these values to browser code or commit them.

## API contract
POST /api/chat
{
  "provider": "c" | "q" | "d" | "all",
  "project": "zero-one" | "movement" | "core",
  "thread_id": "...",
  "message": "..."
}

Server owns conversation history. Provider responses are normalized to:
{
  "thread_id": "...",
  "responses": [
    {"provider":"c","actor":"C博士","text":"...","model":"..."},
    {"provider":"q","actor":"Q博士","text":"...","model":"..."},
    {"provider":"d","actor":"D博士","text":"...","model":"..."}
  ]
}

## Identity
V0.1 production gate requires OWNER authentication before /api/chat. Browser localStorage is not authentication.

## Persistence
Persist raw user messages and normalized provider replies before returning success. Each record binds owner/workspace/thread/provider/model/timestamp/project. Knowledge promotion is a separate audited event; chat text is not automatically canonical knowledge.
