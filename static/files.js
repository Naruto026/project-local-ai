/** Multi-file upload — temporary context only (not saved to chat history) */
window.AppFiles = (() => {
    const chipsEl = document.getElementById('file-chips');
    const fileInput = document.getElementById('file-input');
    const attachBtn = document.getElementById('attach-btn');
    const fileActions = document.getElementById('file-actions');
    const btnSummarize = document.getElementById('btn-summarize-files');
    const btnAskFiles = document.getElementById('btn-ask-files');

    const files = new Map();

    function isGenerating() {
        return window.AppChat?.isStreaming?.() === true;
    }

    function renderChips() {
        if (!chipsEl) return;
        chipsEl.innerHTML = '';
        files.forEach((meta, id) => {
            const chip = document.createElement('div');
            chip.className = 'file-chip' + (meta.uploading ? ' uploading' : '');
            chip.dataset.id = id;
            const trunc = meta.truncated ? '<span class="file-badge">truncated</span>' : '';
            chip.innerHTML = `
                <span class="file-chip-name" title="${escapeAttr(meta.filename)}">${escapeHtml(meta.filename)}</span>
                ${meta.uploading ? '<span class="file-chip-status">Extracting…</span>' : `<span class="file-chip-meta">${meta.charCount || 0} chars</span>${trunc}`}
                <button type="button" class="file-chip-remove" aria-label="Remove file">×</button>
            `;
            chip.querySelector('.file-chip-remove')?.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFile(id);
            });
            chipsEl.appendChild(chip);
        });
        fileActions?.classList.toggle('hidden', files.size === 0);
        attachBtn?.toggleAttribute('disabled', files.size >= 3 || isGenerating());
    }

    function escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function escapeAttr(t) {
        return escapeHtml(t).replace(/"/g, '&quot;');
    }

    function getActiveFileIds() {
        return [...files.keys()].filter((id) => !files.get(id)?.uploading);
    }

    async function uploadOne(file) {
        if (isGenerating()) {
            window.showToast?.('Please wait until the current response finishes.');
            return;
        }
        if (files.size >= 3) {
            window.showToast?.('Maximum 3 files. Remove one to add another.');
            return;
        }
        const tempId = 'pending-' + Date.now();
        files.set(tempId, { filename: file.name, uploading: true });
        renderChips();

        const form = new FormData();
        form.append('file', file);
        try {
            const res = await fetch('/api/files/upload', { method: 'POST', body: form });
            const data = await res.json();
            files.delete(tempId);
            if (!res.ok) {
                window.showToast?.(data.error || 'Upload failed');
                renderChips();
                return;
            }
            files.set(data.id, {
                filename: data.filename,
                charCount: data.charCount,
                truncated: data.truncated,
                uploading: false,
            });
            if (data.truncated) {
                window.showToast?.('File text was truncated to fit context limits.');
            }
        } catch (e) {
            files.delete(tempId);
            window.showToast?.('Upload failed. Check your connection.');
        }
        renderChips();
    }

    async function removeFile(id) {
        if (id.startsWith('pending-')) {
            files.delete(id);
            renderChips();
            return;
        }
        try {
            await fetch(`/api/files/${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error(e);
        }
        files.delete(id);
        renderChips();
    }

    function clearAll() {
        files.clear();
        fetch('/api/files/clear', { method: 'POST' }).catch(() => {});
        renderChips();
    }

    attachBtn?.addEventListener('click', () => {
        if (isGenerating()) {
            window.showToast?.('Please wait until the current response finishes.');
            return;
        }
        if (files.size >= 3) {
            window.showToast?.('Maximum 3 files. Remove one to add another.');
            return;
        }
        fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
        const list = [...(fileInput.files || [])];
        fileInput.value = '';
        const room = 3 - files.size;
        if (list.length > room) {
            window.showToast?.(`Only ${room} more file(s) allowed.`);
            list.splice(room);
        }
        list.forEach(uploadOne);
    });

    btnSummarize?.addEventListener('click', () => {
        if (!getActiveFileIds().length) return;
        window.AppChat?.sendPrompt?.(
            'Summarize the attached document(s) concisely. Use bullet points for key ideas.'
        );
    });

    btnAskFiles?.addEventListener('click', () => {
        if (!getActiveFileIds().length) return;
        userInput?.focus();
        window.showToast?.('Ask a question about your attached files.');
    });

    const userInput = document.getElementById('user-input');

    renderChips();

    return {
        getActiveFileIds,
        clearAll,
        refreshAttachState: renderChips,
    };
})();
