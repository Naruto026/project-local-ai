const chatBox = document.getElementById('chat-box');
const welcomeState = document.getElementById('welcome-state');
const newChatBtn = document.getElementById('new-chat-btn');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const conversationList = document.getElementById('conversation-list');
const chatTitle = document.getElementById('chat-title');
const statusPill = document.getElementById('status-pill');
const typingIndicator = document.getElementById('typing-indicator');
const toastEl = document.getElementById('toast');

// New DOM Elements for UI Refinements
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarSearch = document.getElementById('sidebar-search');

// Restore Sidebar state on desktop
if (localStorage.getItem('sidebar-collapsed') === 'true' && window.innerWidth > 768) {
    document.body.classList.add('sidebar-collapsed');
}

let isStreaming = false;
let activeConvId = null;
let sseBuffer = '';
let streamDelayMs = 120;
let scrollPending = false;
let lastModelSwitch = '';
let modelSwitching = false;

if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
}

const isUserRole = (role) => role === 'user';
const isAiRole = (role) => role === 'assistant' || role === 'ai';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(msg, ms = 3200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add('hidden'), ms);
}
window.showToast = showToast;

function setStatus(text) {
    if (!statusPill) return;
    if (!text) {
        statusPill.textContent = '';
        statusPill.classList.add('hidden');
        return;
    }
    statusPill.textContent = text;
    statusPill.classList.remove('hidden');
}

function setTyping(on) {
    typingIndicator?.classList.toggle('hidden', !on);
    typingIndicator?.setAttribute('aria-hidden', on ? 'false' : 'true');
}

function updateWelcomeVisibility() {
    const hasMsgs = chatBox.querySelectorAll('.message').length > 0;
    welcomeState?.classList.toggle('hidden', hasMsgs);
}

function setChatTitle(title) {
    if (chatTitle) chatTitle.textContent = title || 'New chat';
}

function setInputEnabled(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    sendBtn.classList.toggle('disabled', !enabled);
    document.getElementById('input-area')?.classList.toggle('generating', !enabled);
    window.AppFiles?.refreshAttachState?.();
}

function scheduleScroll() {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
        scrollPending = false;
        const scroll = document.getElementById('chat-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
    });
}

function enrichCodeBlocks(container) {
    container.querySelectorAll('pre').forEach((pre) => {
        if (pre.parentNode.classList.contains('code-block-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const codeEl = pre.querySelector('code');
        let lang = 'code';
        if (codeEl) {
            const classes = [...codeEl.classList];
            const langClass = classes.find(c => c.startsWith('language-'));
            if (langClass) {
                lang = langClass.replace('language-', '');
            }
        }

        const langSpan = document.createElement('span');
        langSpan.className = 'code-lang';
        langSpan.textContent = lang;

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-copy-btn';
        copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
        `;

        copyBtn.addEventListener('click', async () => {
            const codeText = codeEl ? codeEl.textContent : pre.textContent;
            try {
                await navigator.clipboard.writeText(codeText);
                copyBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    `;
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy', err);
            }
        });

        header.appendChild(langSpan);
        header.appendChild(copyBtn);

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

function renderAiBubble(bubble, text, highlight = true) {
    bubble.classList.remove('streaming');
    bubble.innerHTML = marked.parse(text);
    if (highlight) {
        bubble.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
    }
    enrichCodeBlocks(bubble);
    updateWelcomeVisibility();
    scheduleScroll();
}

function createStreamingBubble() {
    welcomeState?.classList.add('hidden');
    const wrapper = document.createElement('div');
    wrapper.className = 'message ai-message';
    const bubble = document.createElement('div');
    bubble.className = 'bubble streaming';
    const pre = document.createElement('pre');
    pre.className = 'stream-plain';
    const textNode = document.createTextNode('');
    pre.appendChild(textNode);
    bubble.appendChild(pre);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
    scheduleScroll();
    return { bubble, textNode };
}

function switchModel(model, background = true) {
    if (!model || (model === lastModelSwitch && !background)) return Promise.resolve();
    const run = async () => {
        if (modelSwitching) return;
        modelSwitching = true;
        modelSelect.classList.add('loading');
        setStatus('Loading model…');
        try {
            const res = await fetch('/api/models/active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Model switch failed');
            lastModelSwitch = model;
        } catch (e) {
            console.error(e);
            showToast(e.message || 'Model switch failed');
        } finally {
            modelSelect.classList.remove('loading');
            if (!isStreaming) setStatus('');
            modelSwitching = false;
        }
    };
    if (background) {
        run();
        return Promise.resolve();
    }
    return run();
}

async function loadModels() {
    setStatus('Connecting…');
    try {
        const [modelsRes, settingsRes, healthRes] = await Promise.all([
            fetch('/models'),
            fetch('/api/settings'),
            fetch('/api/health'),
        ]);
        const models = await modelsRes.json();
        const settings = await settingsRes.json();
        const health = await healthRes.json().catch(() => ({}));
        if (!health.ollama) showToast('Ollama not detected — install and run ollama serve');
        if (health.tesseract === false) {
            console.info('Tesseract not installed — image OCR disabled.');
        }

        streamDelayMs = settings?.chat?.streamDelay ?? 120;
        modelSelect.innerHTML = '';
        if (!models.length) {
            modelSelect.innerHTML = '<option value="">No models</option>';
            setStatus('');
            return;
        }
        models.forEach((model) => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
        await switchModel(modelSelect.value, false);
    } catch (error) {
        console.error(error);
        showToast('Failed to load models');
    } finally {
        if (!isStreaming) setStatus('');
    }
}

function formatConvMeta(created) {
    if (!created || created.length < 8) return '';
    try {
        const y = created.slice(0, 4);
        const m = created.slice(4, 6);
        const d = created.slice(6, 8);
        return `${m}/${d}/${y.slice(2)}`;
    } catch {
        return '';
    }
}

function applySearchFilter() {
    if (!sidebarSearch) return;
    const q = sidebarSearch.value.toLowerCase().trim();
    document.querySelectorAll('.conversation-item').forEach((item) => {
        const titleEl = item.querySelector('.conv-title');
        if (titleEl) {
            const text = titleEl.textContent.toLowerCase();
            item.style.display = text.includes(q) ? '' : 'none';
        }
    });
}

async function loadConversations() {
    try {
        const response = await fetch('/conversations');
        if (!response.ok) throw new Error('Failed to load');
        const conversations = await response.json();
        conversationList.innerHTML = '';
        if (!conversations.length) {
            conversationList.innerHTML = '<p class="sidebar-empty">No conversations yet</p>';
            return;
        }
        conversations.forEach((conv) => {
            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.setAttribute('role', 'listitem');
            div.dataset.convId = conv.id;
            if (conv.id === activeConvId) div.classList.add('active');
            const meta = formatConvMeta(conv.created);
            div.innerHTML = `
                <div class="conv-body">
                    <span class="conv-title" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title)}</span>
                    ${meta ? `<span class="conv-meta">${meta}</span>` : ''}
                </div>
                <button type="button" class="delete-btn" aria-label="Delete">×</button>
            `;
            div.onclick = (e) => {
                if (e.target.closest('.delete-btn')) return;
                loadConversation(conv.id, conv.title);
            };
            div.querySelector('.delete-btn').onclick = async (e) => {
                e.stopPropagation();
                const ok = await AppModal.confirm(
                    'Delete this conversation? This cannot be undone.',
                    'Delete conversation'
                );
                if (!ok) return;
                div.classList.add('deleting');
                try {
                    const res = await fetch(`/conversations/${conv.id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Delete failed');
                    if (activeConvId === conv.id) {
                        activeConvId = null;
                        chatBox.querySelectorAll('.message').forEach((n) => n.remove());
                        setChatTitle('New chat');
                        updateWelcomeVisibility();
                    }
                    loadConversations();
                } catch (error) {
                    showToast('Could not delete conversation');
                    div.classList.remove('deleting');
                }
            };
            conversationList.appendChild(div);
        });
        applySearchFilter();
    } catch (error) {
        conversationList.innerHTML = '<p class="sidebar-empty">Could not load chats</p>';
    }
}

async function loadConversation(convId, title) {
    if (isStreaming) return;
    chatBox.classList.add('loading');
    try {
        const response = await fetch(`/conversations/${convId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Not found');
        activeConvId = convId;
        chatBox.querySelectorAll('.message').forEach((n) => n.remove());
        data.messages.forEach((msg) => {
            const role = isAiRole(msg.role) ? 'assistant' : msg.role;
            createMessage(role, msg.content);
        });
        setChatTitle(data.title || title || 'Chat');
        loadConversations();
    } catch (error) {
        showToast('Could not open conversation');
    } finally {
        chatBox.classList.remove('loading');
        updateWelcomeVisibility();
    }
}

newChatBtn.addEventListener('click', async () => {
    if (isStreaming) return;
    try {
        const response = await fetch('/conversations/new', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        activeConvId = data.id;
        chatBox.querySelectorAll('.message').forEach((n) => n.remove());
        window.AppFiles?.clearAll?.();
        createMessage('ai', data.greeting || 'Hello! How can I assist you today?');
        setChatTitle('New chat');
        loadConversations();
    } catch (error) {
        showToast('Could not start new chat');
    }
});

function createMessage(role, content = '') {
    const wrapper = document.createElement('div');
    wrapper.className = isUserRole(role)
        ? 'message user-message'
        : 'message ai-message';
    const bubble = document.createElement('div');
    bubble.className = 'bubble markdown-body';
    if (isUserRole(role)) {
        bubble.textContent = content;
    } else if (content) {
        renderAiBubble(bubble, content);
    }
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
    updateWelcomeVisibility();
    scheduleScroll();
    return bubble;
}

let lastStreamRender = 0;
function appendStreamToken(textNode, token) {
    textNode.data += token;
    const now = performance.now();
    if (now - lastStreamRender >= streamDelayMs) {
        lastStreamRender = now;
        scheduleScroll();
    }
}

function processSseLine(line, stream, state) {
    if (!line.startsWith('data: ')) return;
    try {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
            state.fullText += data.token;
            appendStreamToken(stream.textNode, data.token);
        } else if (data.error) {
            throw new Error(data.error);
        }
    } catch (err) {
        if (err instanceof SyntaxError) return;
        throw err;
    }
}

async function sendMessage(optionalMessage) {
    const isStringMsg = typeof optionalMessage === 'string';
    const message = (isStringMsg ? optionalMessage : userInput.value).trim();
    const model = modelSelect.value;
    if (!message || isStreaming || !model) return;

    isStreaming = true;
    setInputEnabled(false);
    setTyping(true);
    setStatus('Generating…');
    createMessage('user', message);
    if (!isStringMsg) {
        userInput.value = '';
        userInput.style.height = 'auto';
    }
    const stream = createStreamingBubble();
    const state = { fullText: '' };
    lastStreamRender = 0;

    try {
        const fileIds = window.AppFiles?.getActiveFileIds?.() ?? [];
        if (fileIds.length) {
            console.debug('[chat] sending fileIds:', fileIds);
        }
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, model, fileIds }),
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
                processSseLine(line.trimEnd(), stream, state);
            }
        }
        if (sseBuffer.trim()) {
            processSseLine(sseBuffer.trimEnd(), stream, state);
        }
        renderAiBubble(stream.bubble, state.fullText);
    } catch (error) {
        console.error(error);
        stream.bubble.classList.remove('streaming');
        stream.bubble.innerHTML = `<span class="error-text">Error: ${escapeHtml(error.message)}</span>`;
        showToast(error.message);
    } finally {
        isStreaming = false;
        setTyping(false);
        setStatus('');
        setInputEnabled(true);
        userInput.focus();
        loadConversations();
    }
}

modelSelect.addEventListener('change', () => switchModel(modelSelect.value, true));

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 160)}px`;
});

// Sidebar collapsible toggles
sidebarToggleBtn?.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        document.body.classList.toggle('sidebar-open');
    } else {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed ? 'true' : 'false');
    }
});

sidebarCloseBtn?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
});

sidebarOverlay?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
});

// Search input
sidebarSearch?.addEventListener('input', applySearchFilter);

// Suggestion chips
document.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
            sendMessage(prompt);
        }
    });
});

window.AppChat = {
    setStreamDelay: (ms) => { streamDelayMs = ms; },
    reloadActive: () => activeConvId && loadConversation(activeConvId),
    onSettingsSaved: async () => switchModel(modelSelect.value, false),
    isStreaming: () => isStreaming,
    sendPrompt: (text) => sendMessage(text),
};

loadModels();
loadConversations();
updateWelcomeVisibility();
