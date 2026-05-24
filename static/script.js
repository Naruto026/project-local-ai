const chatBox = document.getElementById('chat-box');
const newChatBtn = document.getElementById('new-chat-btn');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const conversationList = document.getElementById('conversation-list');

let isStreaming = false;
let activeConvId = null;
let sseBuffer = '';

const isUserRole = (role) => role === 'user';
const isAiRole = (role) => role === 'assistant' || role === 'ai';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setInputEnabled(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    sendBtn.classList.toggle('disabled', !enabled);
}

function renderAiBubble(bubble, text, highlight = true) {
    bubble.innerHTML = marked.parse(text);
    if (highlight) {
        bubble.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

let renderScheduled = false;
function scheduleAiRender(bubble, text) {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        renderScheduled = false;
        renderAiBubble(bubble, text, false);
    });
}

async function loadModels() {
    try {
        const response = await fetch('/models');
        const models = await response.json();
        modelSelect.innerHTML = '';
        models.forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Model loading failed:', error);
    }
}

async function loadConversations() {
    try {
        const response = await fetch('/conversations');
        const conversations = await response.json();
        conversationList.innerHTML = '';
        conversations.forEach((conv) => {
            const div = document.createElement('div');
            div.className = 'conversation-item';
            if (conv.id === activeConvId) div.classList.add('active');
            div.innerHTML = `
                <span class="conv-title">${escapeHtml(conv.title)}</span>
                <button type="button" class="delete-btn" aria-label="Delete conversation">×</button>
            `;
            div.onclick = () => loadConversation(conv.id);
            div.querySelector('.delete-btn').onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this conversation?')) return;
                try {
                    await fetch(`/conversations/${conv.id}`, { method: 'DELETE' });
                    if (activeConvId === conv.id) {
                        activeConvId = null;
                        chatBox.innerHTML = '';
                    }
                    loadConversations();
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

async function loadConversation(convId) {
    if (isStreaming) return;
    try {
        const response = await fetch(`/conversations/${convId}`);
        if (!response.ok) return;
        const data = await response.json();
        activeConvId = convId;
        chatBox.innerHTML = '';
        data.messages.forEach((msg) => createMessage(msg.role, msg.content));
        loadConversations();
    } catch (error) {
        console.error('Conversation open failed:', error);
    }
}

newChatBtn.addEventListener('click', async () => {
    if (isStreaming) return;
    try {
        const response = await fetch('/conversations/new', { method: 'POST' });
        const data = await response.json();
        activeConvId = data.id;
        chatBox.innerHTML = '';
        createMessage('ai', 'Hello! How can I assist you today?');
        loadConversations();
    } catch (error) {
        console.error('New chat error:', error);
    }
});

function createMessage(role, content = '') {
    const wrapper = document.createElement('div');
    wrapper.className = isUserRole(role)
        ? 'message user-message'
        : 'message ai-message';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (isUserRole(role)) {
        bubble.textContent = content;
    } else {
        renderAiBubble(bubble, content);
    }
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
}

function processSseLine(line, aiBubble, state) {
    if (!line.startsWith('data: ')) return;
    try {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
            state.fullText += data.token;
            scheduleAiRender(aiBubble, state.fullText);
        } else if (data.error) {
            throw new Error(data.error);
        }
    } catch (err) {
        if (err instanceof SyntaxError) return;
        throw err;
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    const model = modelSelect.value;
    if (!message || isStreaming) return;

    isStreaming = true;
    setInputEnabled(false);
    createMessage('user', message);
    userInput.value = '';
    const aiBubble = createMessage('ai');
    const state = { fullText: '' };

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, model }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        sseBuffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const parts = sseBuffer.split('\n');
            sseBuffer = parts.pop() || '';
            for (const line of parts) {
                processSseLine(line.trimEnd(), aiBubble, state);
            }
        }
        if (sseBuffer.trim()) {
            processSseLine(sseBuffer.trimEnd(), aiBubble, state);
        }
        renderAiBubble(aiBubble, state.fullText);
    } catch (error) {
        console.error(error);
        aiBubble.innerHTML = `<span class="error-text">Error: ${escapeHtml(error.message)}</span>`;
    } finally {
        isStreaming = false;
        setInputEnabled(true);
        userInput.focus();
        loadConversations();
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

loadModels();
loadConversations();
