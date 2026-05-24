from flask import Flask, render_template, request, jsonify, Response
import ollama
import json
import os
from datetime import datetime

app = Flask(__name__, template_folder='templates', static_folder='static')

CONVERSATIONS_DIR = 'conversations'
os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

current_conversation_id = None
chat_history = []


def conversation_title(messages):
    for msg in messages:
        if msg.get('role') == 'user':
            return msg['content'][:40]
    return 'New Chat'


def save_conversation(conv_id, messages):
    path = os.path.join(CONVERSATIONS_DIR, f'{conv_id}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({
            'id': conv_id,
            'title': conversation_title(messages),
            'created': conv_id,
            'messages': messages,
        }, f, indent=2, ensure_ascii=False)


def load_conversation(conv_id):
    path = os.path.join(CONVERSATIONS_DIR, f'{conv_id}.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_all_conversations():
    conversations = []
    for file in sorted(os.listdir(CONVERSATIONS_DIR), reverse=True):
        if not file.endswith('.json'):
            continue
        with open(os.path.join(CONVERSATIONS_DIR, file), encoding='utf-8') as f:
            data = json.load(f)
        conversations.append({
            'id': data['id'],
            'title': data['title'],
            'created': data['created'],
        })
    return conversations


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/models')
def get_models():
    try:
        response = ollama.list()
        return jsonify([model.model for model in response.models])
    except Exception as e:
        print('MODEL ERROR:', e)
        return jsonify([])


@app.route('/conversations', methods=['GET'])
def list_conversations():
    return jsonify(get_all_conversations())


@app.route('/conversations/new', methods=['POST'])
def new_conversation():
    global current_conversation_id, chat_history
    current_conversation_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    chat_history = []
    return jsonify({'id': current_conversation_id})


@app.route('/conversations/<conv_id>', methods=['GET'])
def get_conversation(conv_id):
    global current_conversation_id, chat_history
    data = load_conversation(conv_id)
    if not data:
        return jsonify({'error': 'Conversation not found'}), 404
    current_conversation_id = conv_id
    chat_history = data['messages']
    return jsonify(data)


@app.route('/conversations/<conv_id>', methods=['DELETE'])
def delete_conversation(conv_id):
    global current_conversation_id, chat_history
    path = os.path.join(CONVERSATIONS_DIR, f'{conv_id}.json')
    if not os.path.exists(path):
        return jsonify({'error': 'Conversation not found'}), 404
    os.remove(path)
    if current_conversation_id == conv_id:
        current_conversation_id = None
        chat_history = []
    return jsonify({'success': True})


@app.route('/chat', methods=['POST'])
def chat():
    global current_conversation_id, chat_history

    data = request.json or {}
    message = data.get('message', '').strip()
    model = data.get('model', 'llama3')

    if not message:
        return jsonify({'error': 'Empty message'}), 400

    if not current_conversation_id:
        current_conversation_id = datetime.now().strftime('%Y%m%d_%H%M%S')

    chat_history.append({'role': 'user', 'content': message})

    def generate():
        global chat_history
        full_reply = ''
        try:
            stream = ollama.chat(
                model=model,
                messages=chat_history,
                stream=True,
            )
            for chunk in stream:
                token = chunk['message']['content']
                full_reply += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            chat_history.append({'role': 'assistant', 'content': full_reply})
            save_conversation(current_conversation_id, chat_history)
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            if chat_history and chat_history[-1].get('role') == 'user':
                chat_history.pop()
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')


if __name__ == '__main__':
    app.run(debug=True)
