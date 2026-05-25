import json
import os
from datetime import datetime

import ollama
from flask import Blueprint, jsonify, request, Response

from core.session import session
from core.chat_context import build_chat_payload, chat_options
from services.ollama_service import ensure_single_model
from storage.conversation_store import save_conversation
from storage.settings_store import load_settings

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/chat', methods=['POST'])
def chat():
    data = request.json or {}
    message = data.get('message', '').strip()
    model = data.get('model', 'llama3')
    file_ids = data.get('fileIds') or data.get('file_ids') or []
    if isinstance(file_ids, str):
        file_ids = [file_ids]
    settings = load_settings()

    if os.environ.get('LOCAL_AI_DEBUG_FILES', '').lower() in ('1', 'true', 'yes'):
        print(f'[CHAT] fileIds from client: {file_ids!r}')

    if not message:
        return jsonify({'error': 'Empty message'}), 400

    if not session.conversation_id:
        session.conversation_id = datetime.now().strftime('%Y%m%d_%H%M%S')

    session.chat_history.append({'role': 'user', 'content': message})
    ensure_single_model(model, settings)

    payload_messages = build_chat_payload(model, settings, file_ids=file_ids)

    if os.environ.get('LOCAL_AI_DEBUG_FILES', '').lower() in ('1', 'true', 'yes'):
        for i, m in enumerate(payload_messages):
            preview = (m.get('content') or '')[:120].replace('\n', ' ')
            print(f'[CHAT] payload[{i}] role={m.get("role")} len={len(m.get("content") or "")} preview={preview!r}')

    keep_alive = settings['model'].get('keepAlive', '5m')
    options = chat_options(settings)

    def generate():
        full_reply = ''
        try:
            stream = ollama.chat(
                model=model,
                messages=payload_messages,
                stream=True,
                keep_alive=keep_alive,
                options=options or None,
            )
            for chunk in stream:
                token = chunk['message']['content']
                full_reply += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            session.chat_history.append({'role': 'assistant', 'content': full_reply})
            save_conversation(session.conversation_id, session.chat_history)
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            if session.chat_history and session.chat_history[-1].get('role') == 'user':
                session.chat_history.pop()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')
