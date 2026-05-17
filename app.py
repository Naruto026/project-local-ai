from flask import Flask, render_template, request, jsonify
import ollama

app = Flask(__name__, template_folder='templates', static_folder='static')

chat_history = []

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    message = data['message']
    model = data['model']
    
    chat_history.append({'role': 'user', 'content': message})
    
    response = ollama.chat(
        model=model,
        messages=chat_history
    )
    
    reply = response['message']['content']
    chat_history.append({'role': 'assistant', 'content': reply})
    
    return jsonify({'response': reply})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3000, debug=True)