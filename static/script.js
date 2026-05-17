document.getElementById('send-btn').onclick = async function() {
    const message = document.getElementById('user-input').value;
    const model = document.getElementById('model-select').value;

    if (!message) return;

    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<div class="user-msg">You: ${message}</div>`;
    document.getElementById('user-input').value = '';

    const response = await fetch('/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message, model})
    });

    const data = await response.json();
    chatBox.innerHTML += `<div class="ai-msg">AI: ${data.response}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('user-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('send-btn').click();
    }
});