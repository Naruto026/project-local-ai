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
## Setup

### Requirements
- Python 3.8+
- Ollama installed
- NVIDIA GPU recommended (works on CPU too, slower)

### Step 1 — Install Ollama
Download from https://ollama.com and install it.

### Step 2 — Pull AI Models
Open terminal and run:
ollama pull qwen2.5-coder:7b
ollama pull llama3.2:3b

### Step 3 — Install Python Dependencies
pip install flask ollama pymupdf python-docx openpyxl

### Step 4 — Run the App
python app.py

### Step 5 — Open in Browser
http://127.0.0.1:3000

## Screenshots
(coming soon)