/** Settings panel — syncs with /api/settings */
window.AppSettings = (() => {
    const panel = document.getElementById('settings-panel');
    const form = document.getElementById('settings-form');
    let cache = null;

    const fields = {
        'model.keepAlive': 'setting-keep-alive',
        'model.unloadOnSwitch': 'setting-unload-switch',
        'model.temperature': 'setting-temperature',
        'model.numCtx': 'setting-num-ctx',
        'memory.enabled': 'setting-memory-enabled',
        'memory.maxMessages': 'setting-max-messages',
        'memory.summarize': 'setting-summarize',
        'memory.summarizeThreshold': 'setting-summarize-threshold',
        'chat.streamDelay': 'setting-stream-delay',
        'chat.greeting': 'setting-greeting',
        'chat.customInstructions': 'setting-custom-instructions',
        'appearance.accentColor': 'setting-accent',
        'appearance.fontSize': 'setting-font-size',
        'appearance.compactMode': 'setting-compact',
        'appearance.animations': 'setting-animations',
    };

    function getNested(obj, path) {
        return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
    }

    function setNested(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
        cur[keys[keys.length - 1]] = value;
    }

    function readForm() {
        const data = JSON.parse(JSON.stringify(cache || {}));
        Object.entries(fields).forEach(([path, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            let val = el.type === 'checkbox' ? el.checked : el.value;
            if (el.type === 'number' || el.type === 'range') val = Number(val);
            if (el.tagName === 'TEXTAREA') val = el.value;
            setNested(data, path, val);
        });
        return data;
    }

    function fillForm(data) {
        Object.entries(fields).forEach(([path, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = getNested(data, path);
            if (el.type === 'checkbox') el.checked = !!val;
            else if (el.tagName === 'TEXTAREA') el.value = val ?? '';
            else el.value = val ?? '';
        });
    }

    function applyAppearance(data) {
        const root = document.documentElement;
        const accent = data?.appearance?.accentColor;
        if (accent) {
            root.style.setProperty('--accent', accent);
            root.style.setProperty('--accent-hover', accent);
        }
        document.body.classList.toggle('compact', !!data?.appearance?.compactMode);
        document.body.classList.toggle('no-animations', !data?.appearance?.animations);
        
        // Font Size Accessibility Setting
        const fontSize = data?.appearance?.fontSize || 'normal';
        document.body.classList.remove('font-size-small', 'font-size-normal', 'font-size-large');
        document.body.classList.add(`font-size-${fontSize}`);

        if (window.AppChat?.setStreamDelay) {
            window.AppChat.setStreamDelay(data?.chat?.streamDelay ?? 120);
        }
    }

    async function load() {
        const res = await fetch('/api/settings');
        cache = await res.json();
        fillForm(cache);
        applyAppearance(cache);
        return cache;
    }

    async function save() {
        cache = readForm();
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cache),
        });
        const data = await res.json();
        if (!res.ok) {
            AppModal.alert(data.error || 'Could not save settings', 'Settings');
            return cache;
        }
        cache = data;
        applyAppearance(cache);
        return cache;
    }

    function open() {
        panel?.classList.add('open');
        document.body.classList.add('settings-open');
        load();
    }

    function close() {
        panel?.classList.remove('open');
        document.body.classList.remove('settings-open');
    }

    document.getElementById('settings-btn')?.addEventListener('click', open);
    document.getElementById('settings-close')?.addEventListener('click', close);
    document.getElementById('settings-backdrop')?.addEventListener('click', close);
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await save();
        if (window.AppChat?.onSettingsSaved) await window.AppChat.onSettingsSaved(cache);
        close();
    });

    document.getElementById('btn-clear-memory')?.addEventListener('click', async () => {
        const ok = await AppModal.confirm(
            'Clear in-session memory for the current chat? Saved conversations are kept.',
            'Clear memory',
            { confirmText: 'Clear', danger: false }
        );
        if (!ok) return;
        await fetch('/api/memory/clear', { method: 'POST' });
        AppModal.alert('Session memory cleared.', 'Memory');
    });

    document.getElementById('btn-export-chats')?.addEventListener('click', () => {
        window.location.href = '/api/conversations/export';
    });

    document.getElementById('btn-summarize-now')?.addEventListener('click', async () => {
        const model = document.getElementById('model-select')?.value;
        if (!model) return AppModal.alert('Select a model first.', 'Summarize');
        const res = await fetch('/api/memory/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model }),
        });
        const data = await res.json();
        if (!res.ok) return AppModal.alert(data.error || 'Summarize failed.', 'Error');
        AppModal.alert(`Compressed to ${data.messages} messages.`, 'Summarize');
        if (window.AppChat?.reloadActive) await window.AppChat.reloadActive();
    });

    if (location.hash === '#settings' || window.__OPEN_SETTINGS__) open();
    load();

    return { load, save, get: () => cache, applyAppearance, open, close };
})();
