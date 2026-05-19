const chatBox = document.getElementById('chat-box');
const newChatBtn = document.getElementById('new-chat-btn');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');

async function loadModels() {
    const response = await fetch('/models');
    const models = await response.json();
    const modelSelect = document.getElementById('model-select');
    modelSelect.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });
}

loadModels();

async function loadConversations() {
    try {
        const response = await fetch('/conversations');
        const conversations = await response.json();
        const conversationList = document.getElementById('conversation-list');
        conversationList.innerHTML = '';
        conversations.forEach(conv => {
            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.innerHTML = `
                <span>${conv.title}</span>
                <button class="delete-btn">×</button>
            `;
            div.onclick = () => loadConversation(conv.id);
            const deleteBtn = div.querySelector('.delete-btn');
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                const confirmed = confirm(
                    'Delete this conversation?'
                );
                if (!confirmed) return;
                try {
                    await fetch(`/conversations/${conv.id}`, {
                        method: 'DELETE'
                    });
                    loadConversations();
                    chatBox.innerHTML = '';
                } catch (error) {
                    console.error('Delete failed:', error);
                }
            };
            conversationList.appendChild(div);
        });
    } catch (error) {
        console.error('Conversation loading failed:', error);
    }
}

loadConversations();

async function loadConversation(convId) {
    try {
        const response = await fetch(`/conversations/${convId}`);
        const data = await response.json();
        chatBox.innerHTML = '';
        data.messages.forEach(msg => {
            createMessage(msg.role, msg.content);
        });
    } catch (error) {
        console.error('Conversation open failed:', error);
    }
}

newChatBtn.addEventListener('click', async () => {
    try {
        await fetch('/conversations/new', {
            method: 'POST'
        });
        chatBox.innerHTML = '';
        createMessage(
            'ai',
            'Hello! How can I assist you today?'
        );
        loadConversations();
    } catch (error) {
        console.error('New chat error:', error);
    }
});

function createMessage(role, content = '') {
    const wrapper = document.createElement('div');
    wrapper.className = role === 'user' ? 'message user-message' : 'message ai-message';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'user') {
        bubble.textContent = content;
    } else {
        bubble.innerHTML = marked.parse(content);
    }
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
}

async function sendMessage() {
    const message = userInput.value.trim();
    const model = modelSelect.value;

    if (!message) return;

    createMessage('user', message);

    userInput.value = '';

    const aiBubble = createMessage('ai');

    let fullText = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                model
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.token) {
                            fullText += data.token;
                            aiBubble.innerHTML = marked.parse(fullText);
                            document.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightElement(block);
                            });
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

    } catch (error) {
        console.error(error);
        aiBubble.innerHTML = `
            <span style="color:red;">
                Error: ${error.message}
            </span>
        `;
    }

    loadConversations(); // Add this line to update the sidebar
}

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});