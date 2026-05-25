# Local AI Assistant

A private, local chat app powered by **Flask**, **Ollama**, and a lightweight web UI. Runs on your machine — no cloud API keys required.

## Features

- Dark, polished chat interface with conversation history
- Multiple Ollama models with VRAM-friendly model switching
- Custom instructions (system prompt) via Settings
- Streaming responses, markdown, and syntax highlighting
- Export chats, memory controls, and persistent settings
- **Multi-file upload** (PDF, DOCX, TXT, image OCR) — temporary context only, never saved in chat history

## Quick start (Windows)

1. Install [Python 3.10+](https://python.org) and [Ollama](https://ollama.com)
2. Pull a model: `ollama pull llama3.2`
3. Double-click **`setup.bat`** (first time only)
4. Double-click **`start.bat`** — waits for the server and opens your browser

Manual run:

```bash
cd project-local-ai
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000**

## Tech stack

- Python + Flask
- Ollama (local LLM)
- HTML + CSS + JavaScript (no React/Electron)

## Project structure

```
project-local-ai/
├── app.py              # Flask entry (create_app)
├── config.py           # Paths & defaults
├── routes/             # HTTP blueprints
├── core/               # Session & prompt assembly
├── services/           # Ollama, files, extraction
├── storage/            # Conversations, settings, safe delete
├── data/               # Runtime storage (gitignored)
├── ARCHITECTURE.md     # Full design guide
├── setup.bat / start.bat
└── static/ + templates/
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for module responsibilities and future RAG/agent hooks.

## File attachments

- Click the **paperclip** in the composer (up to **3 files**, 10 MB each)
- Supported: PDF, DOCX, TXT, PNG/JPG (OCR requires [Tesseract](https://github.com/UB-Mannheim/tesseract/wiki))
- File text is injected only during API calls (max ~8000 chars combined) — **not** stored in conversation JSON
- Use **Summarize files** or ask questions about attached documents

## Settings

Open **Settings** in the sidebar to configure models, memory, appearance, and **custom instructions** (how the assistant should behave). Instructions, file context, and chat memory are kept as separate system layers.

## License

MIT — use freely for portfolios and demos.
