"""Ollama model lifecycle and chat helpers."""
import ollama

from core.session import session


def model_base_name(name):
    return name.split(':')[0] if name else name


def unload_model(model_name):
    try:
        ollama.generate(model=model_name, prompt='', keep_alive=0)
    except Exception as e:
        print('UNLOAD', model_name, e)


def unload_inactive_models(keep_model):
    keep = model_base_name(keep_model)
    try:
        running = ollama.ps()
        for entry in running.models:
            name = getattr(entry, 'model', None) or entry.get('model', '')
            base = model_base_name(name)
            if base and base != keep:
                unload_model(base)
    except Exception as e:
        print('PS ERROR:', e)


def ensure_single_model(model_name, settings):
    base = model_base_name(model_name)
    if settings['model'].get('unloadOnSwitch', True):
        unload_inactive_models(base)
    keep_alive = settings['model'].get('keepAlive', '5m')
    if session.active_loaded_model != base:
        try:
            ollama.generate(model=base, prompt=' ', keep_alive=keep_alive, stream=False)
            session.active_loaded_model = base
        except Exception as e:
            print('PRELOAD', base, e)
            session.active_loaded_model = base


def list_model_names():
    response = ollama.list()
    return [m.model for m in response.models]


def tesseract_available():
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def summarize_history(messages, model, settings):
    threshold = int(settings['memory'].get('summarizeThreshold', 24))
    if len(messages) <= threshold:
        return messages
    keep_recent = 8
    older = messages[:-keep_recent]
    recent = messages[-keep_recent:]
    transcript = '\n'.join(
        f"{m['role']}: {m['content'][:500]}" for m in older
    )
    prompt = (
        'Summarize the following conversation concisely for context. '
        'Preserve key facts, decisions, and user preferences.\n\n'
        f'{transcript}'
    )
    try:
        res = ollama.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            stream=False,
            options={'temperature': 0.3},
        )
        summary = res['message']['content']
        return [{'role': 'system', 'content': f'Prior conversation summary:\n{summary}'}] + recent
    except Exception as e:
        print('SUMMARIZE ERROR:', e)
        from core.chat_context import trim_messages
        return trim_messages(messages, settings)
