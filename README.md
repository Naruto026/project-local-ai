# Local AI Chat App 🤖

A locally hosted AI chat assistant built with Python, Flask, and Ollama.
Runs completely on personal hardware — zero API costs, zero cloud dependency.

## Features
- 🌙 Dark theme browser-based chat interface
- 🤖 Multiple AI model support (Qwen2.5-Coder 7B, Llama 3.2 3B)
- 🧠 Session-based conversation memory
- 💻 Local GPU inference via Ollama
- 📄 PDF, Word, Excel file reading (in progress)

## Tech Stack
- Python + Flask
- Ollama
- HTML + CSS + JavaScript

## Setup
1. Install [Ollama](https://ollama.com)
2. Pull models:
   ollama pull qwen2.5-coder:7b
   ollama pull llama3.2:3b
3. Install dependencies:
   pip install flask ollama pymupdf python-docx openpyxl
4. Run:
   python app.py
5. Open browser: http://127.0.0.1:5000

## Screenshots
(coming soon)