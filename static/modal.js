/** Custom confirm/alert — replaces browser dialogs */
window.AppModal = (() => {
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const actionsEl = document.getElementById('modal-actions');
    let resolver = null;

    function close(result) {
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (resolver) {
            const r = resolver;
            resolver = null;
            r(result);
        }
    }

    function open({ title, message, confirmText = 'OK', cancelText = null, danger = false }) {
        return new Promise((resolve) => {
            resolver = resolve;
            titleEl.textContent = title || 'Notice';
            bodyEl.textContent = message || '';
            actionsEl.innerHTML = '';
            if (cancelText) {
                const cancel = document.createElement('button');
                cancel.type = 'button';
                cancel.className = 'btn btn-ghost';
                cancel.textContent = cancelText;
                cancel.onclick = () => close(false);
                actionsEl.appendChild(cancel);
            }
            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = danger ? 'btn btn-danger' : 'btn btn-primary';
            ok.textContent = confirmText;
            ok.onclick = () => close(true);
            actionsEl.appendChild(ok);
            backdrop.classList.add('open');
            backdrop.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            ok.focus();
        });
    }

    backdrop?.querySelector('.modal-card')?.addEventListener('click', (e) => e.stopPropagation());
    backdrop?.addEventListener('click', () => close(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop?.classList.contains('open')) close(false);
    });

    return {
        alert: (message, title = 'Notice') =>
            open({ title, message, confirmText: 'OK' }),
        confirm: (message, title = 'Confirm', { confirmText = 'Delete', cancelText = 'Cancel', danger = true } = {}) =>
            open({ title, message, confirmText, cancelText, danger }),
    };
})();
