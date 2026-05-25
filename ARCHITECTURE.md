# Architecture Guide — Local AI Assistant

Public GitHub portfolio project: local Flask + Ollama chat with file intelligence.

## Design principles

1. **Thin entry point** — `app.py` only creates the Flask app and registers routes.
2. **Routes = HTTP** — no business logic in blueprints beyond validation.
3. **Services = integrations** — Ollama, file extraction, session file cache.
4. **Storage = disk** — conversations, settings, safe delete.
5. **Core = session + prompt assembly** — keeps custom instructions, file context, and chat memory **separate**.
6. **No frameworks** — no LangChain, no Celery, no React rewrite.

## Final folder structure

```
project-local-ai/
├── app.py                      # create_app(), run server
├── config.py                   # paths, DEFAULT_SETTINGS, ensure_data_dirs()
├── ARCHITECTURE.md             # this file
├── README.md
├── requirements.txt
├── setup.bat / start.bat
│
├── routes/                     # Flask blueprints (HTTP only)
│   ├── pages.py                # /, /settings
│   ├── health.py               # /api/health
│   ├── settings.py             # /api/settings
│   ├── models.py               # /models, /api/models/*
│   ├── conversations.py        # /conversations/*, memory APIs
│   ├── files.py                # /api/files/*
│   └── chat.py                 # /chat (SSE)
│
├── core/                       # App logic (no Flask imports in chat_context)
│   ├── session.py              # active conversation + chat_history
│   └── chat_context.py         # build_chat_payload (layered prompts)
│
├── services/                   # External capabilities
│   ├── ollama_service.py       # model load/unload, list, summarize helper
│   ├── file_store.py           # in-memory upload session cache
│   ├── text_utils.py           # clean, truncate, file context block
│   ├── file_extract.py         # re-export (backward compat)
│   └── extract/                # OCR-ready split
│       ├── documents.py        # PDF, DOCX, TXT
│       └── ocr.py              # Tesseract (+ future vision hook)
│
├── storage/                    # Persistence
│   ├── conversation_store.py   # JSON v2 conversations
│   ├── settings_store.py       # settings.json
│   ├── safe_delete.py          # send2trash + data/trash fallback
│   └── migrate.py              # legacy folders → data/
│
├── data/                       # Runtime (gitignored)
│   ├── conversations/          # *.json chat files
│   ├── uploads/                # temp uploaded binaries
│   ├── trash/                  # fallback if send2trash unavailable
│   └── settings.json
│
├── templates/
│   └── index.html
│
└── static/                     # Phase 2: optional static/js/ split
    ├── script.js               # chat UI
    ├── files.js                # uploads
    ├── settings.js
    ├── modal.js
    └── style.css
```

## Message layers (do not merge into one blob)

```
Ollama API messages:
  [1] system: custom instructions     (settings.chat.customInstructions)
  [2] system: attached file context   (temporary, from fileIds — NOT in chat_history)
  [3] user/assistant: chat_history    (saved to conversation JSON only)
```

File text is **never** appended to `chat_history` or conversation files.

## Conversation JSON format (v2)

Recommended schema (human-readable, GitHub-friendly):

```json
{
  "schemaVersion": 2,
  "id": "20260519_180630",
  "title": "Explain Python decorators",
  "createdAt": "2026-05-19T18:06:30",
  "updatedAt": "2026-05-19T18:12:00",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "meta": {}
}
```

Legacy v1 files (`created` instead of `createdAt`) are auto-upgraded on read.

## Safe delete

- Conversation delete uses **send2trash** (Windows Recycle Bin).
- Fallback: move to `data/trash/` if send2trash is missing.
- Upload remove still uses `os.remove` (temp cache only).

## Future extensions (hooks already in place)

| Feature | Where to add |
|---------|----------------|
| RAG / embeddings | `services/rag/` + `storage/vectors/` |
| Agents / tools | `services/agent/` + `routes/tools.py` |
| Vision (LLaVA, etc.) | `services/extract/vision.py` calling Ollama multimodal |
| OpenClaw/Hermes | `services/models/` experiment flags in settings |
| Multi-user | Replace `core/session.py` with per-cookie session store |
| Frontend modules | Move to `static/js/` without changing URLs |

## Refactor steps completed

1. Added `config.py` central paths.
2. Added `storage/` with v2 conversations + migration + send2trash.
3. Added `core/` session and chat context builder.
4. Split `routes/` blueprints from monolithic `app.py`.
5. Split `services/extract/` for OCR vs documents.
6. `data/` runtime layout with legacy migration.

## Migration for existing users

On startup, `storage/migrate.py` copies:

- `conversations/` → `data/conversations/`
- `uploads/` → `data/uploads/`
- `settings.json` → `data/settings.json`

Old folders are left in place (not deleted) for safety.

## Mistakes to avoid

- Putting Ollama calls inside route handlers (hard to test).
- Saving file excerpts into conversation JSON (bloat + privacy).
- One giant `utils.py` (becomes unmaintainable — use `services/` + `storage/`).
- Premature microservices or Docker requirement for a local app.
- Importing Flask inside `core/` (blocks reuse and testing).
- Global state without `session` module (scattered globals in `app.py`).

## Frontend organization (current — OK for portfolio)

Keep flat `static/` until the JS grows; then:

```
static/js/chat.js, files.js, settings.js, modal.js
static/css/style.css
```

## Running

```bat
setup.bat
start.bat
```

```bash
python app.py
```

## Testing checklist after refactor

- [ ] New chat, send message, stream reply
- [ ] Load/delete conversation (check Recycle Bin on Windows)
- [ ] Upload PDF + ask question
- [ ] Settings save/load
- [ ] Export ZIP still works
- [ ] Legacy `conversations/` data appears after first run
