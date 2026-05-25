from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from core.session import session
from services.file_store import clear_all as clear_all_files
from storage import (
    delete_conversation as store_delete,
    export_all_zip,
    get_conversation,
    list_conversations,
    save_conversation,
)
from storage.settings_store import load_settings
from core.chat_context import summarize_history

conversations_bp = Blueprint('conversations', __name__)


@conversations_bp.route('/conversations', methods=['GET'])
def list_conversations_route():
    return jsonify(list_conversations())


@conversations_bp.route('/conversations/new', methods=['POST'])
def new_conversation():
    session.conversation_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    session.chat_history = []
    clear_all_files()
    settings = load_settings()
    return jsonify({
        'id': session.conversation_id,
        'greeting': settings['chat'].get('greeting', 'Hello! How can I assist you today?'),
    })


@conversations_bp.route('/conversations/<conv_id>', methods=['GET'])
def get_conversation_route(conv_id):
    data = get_conversation(conv_id)
    if not data:
        return jsonify({'error': 'Conversation not found'}), 404
    session.conversation_id = conv_id
    session.chat_history = data['messages']
    return jsonify(data)


@conversations_bp.route('/conversations/<conv_id>', methods=['DELETE'])
def delete_conversation_route(conv_id):
    if not store_delete(conv_id):
        return jsonify({'error': 'Conversation not found'}), 404
    if session.conversation_id == conv_id:
        session.reset_chat()
    return jsonify({'success': True, 'recycled': True})


@conversations_bp.route('/api/conversations/export')
def export_conversations():
    buf = export_all_zip()
    return send_file(
        buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'chats-export-{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip',
    )


@conversations_bp.route('/api/memory/clear', methods=['POST'])
def clear_memory():
    session.clear_history()
    if session.conversation_id:
        save_conversation(session.conversation_id, [])
    return jsonify({'success': True})


@conversations_bp.route('/api/memory/summarize', methods=['POST'])
def summarize_now():
    data = request.json or {}
    model = data.get('model', 'llama3')
    settings = load_settings()
    if len(session.chat_history) < 4:
        return jsonify({'error': 'Not enough messages to summarize'}), 400
    settings['memory']['summarize'] = True
    session.chat_history = summarize_history(session.chat_history, model, settings)
    if session.conversation_id:
        save_conversation(session.conversation_id, session.chat_history)
    return jsonify({'success': True, 'messages': len(session.chat_history)})
