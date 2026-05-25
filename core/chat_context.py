"""Build Ollama message payloads — keeps layers separate until final merge."""
import os

from services.file_store import file_limits, get_entries
from services.ollama_service import summarize_history as _summarize
from services.text_utils import build_file_context_block
from core.session import session

# Set LOCAL_AI_DEBUG_FILES=1 to log file context injection
_DEBUG = os.environ.get('LOCAL_AI_DEBUG_FILES', '').lower() in ('1', 'true', 'yes')


def _debug(msg):
    if _DEBUG:
        print(f'[FILE_CTX] {msg}')


def trim_messages(messages, settings):
    max_m = int(settings['memory'].get('maxMessages', 40))
    if len(messages) <= max_m:
        return messages
    return messages[-max_m:]


def summarize_history(messages, model, settings):
    return _summarize(messages, model, settings)


def build_system_message(settings, file_ids):
    """
    Single system message for Ollama (many models ignore 2+ system messages).
    Order inside: custom instructions, then attached file content.
    """
    parts = []

    instr = (settings.get('chat') or {}).get('customInstructions', '').strip()
    if instr:
        parts.append(f'## Custom instructions\n{instr}')

    limits = file_limits(settings)
    entries = get_entries(file_ids)
    _debug(f'file_ids={file_ids!r} entries_found={len(entries)}')
    for ent in entries:
        text_len = len(ent.get('extracted_text') or '')
        _debug(f'  file={ent.get("filename")!r} extracted_chars={text_len} truncated={ent.get("truncated")}')

    if entries:
        block = build_file_context_block(entries, limits['max_context_chars'])
        if block and block.get('content'):
            parts.append(block['content'])
            preview = block['content'][:400].replace('\n', ' ')
            _debug(f'file_block_chars={len(block["content"])} preview={preview!r}...')
        else:
            _debug('build_file_context_block returned empty')

    if not parts:
        return None

    return {
        'role': 'system',
        'content': '\n\n'.join(parts),
    }


def build_chat_payload(model, settings, file_ids=None):
    file_ids = file_ids or []
    history = session.chat_history

    if not settings['memory'].get('enabled', True):
        msgs = [history[-1]] if history else []
    else:
        msgs = list(history)
        if settings['memory'].get('summarize') and len(msgs) > int(
            settings['memory'].get('summarizeThreshold', 24)
        ):
            msgs = summarize_history(msgs, model, settings)
        msgs = trim_messages(msgs, settings)

    system_msg = build_system_message(settings, file_ids)
    if system_msg:
        payload = [system_msg] + msgs
    else:
        payload = msgs

    _debug(f'final_payload_messages={len(payload)} roles={[m.get("role") for m in payload]}')
    if system_msg:
        _debug(f'system_message_total_chars={len(system_msg["content"])}')

    return payload


def chat_options(settings):
    opts = {}
    temp = settings['model'].get('temperature')
    ctx = settings['model'].get('numCtx')
    if temp is not None:
        opts['temperature'] = float(temp)
    if ctx:
        opts['num_ctx'] = int(ctx)
    return opts
