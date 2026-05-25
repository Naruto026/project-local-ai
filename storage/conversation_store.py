"""Conversation persistence — schema v2 JSON files."""
import io
import json
import os
import zipfile
from datetime import datetime

import config
from storage.safe_delete import move_to_trash

SCHEMA_VERSION = config.CONVERSATION_SCHEMA_VERSION


def _conversation_path(conv_id):
    return os.path.join(config.CONVERSATIONS_DIR, f'{conv_id}.json')


def _title_from_messages(messages):
    for msg in messages:
        if msg.get('role') == 'user':
            return (msg.get('content') or '')[:40] or 'New Chat'
    return 'New Chat'


def _parse_legacy_id(created):
    """Legacy id format: YYYYMMDD_HHMMSS -> ISO-ish createdAt."""
    if len(created) >= 15 and '_' in created:
        try:
            dt = datetime.strptime(created, '%Y%m%d_%H%M%S')
            return dt.isoformat()
        except ValueError:
            pass
    return datetime.now().isoformat()


def normalize_conversation(data, conv_id=None):
    """Upgrade legacy or partial records to schema v2."""
    cid = data.get('id') or conv_id
    messages = data.get('messages') or []
    created = data.get('createdAt') or data.get('created') or cid
    if isinstance(created, str) and '_' in created and 'T' not in created:
        created = _parse_legacy_id(created)

    return {
        'schemaVersion': SCHEMA_VERSION,
        'id': cid,
        'title': data.get('title') or _title_from_messages(messages),
        'createdAt': created,
        'updatedAt': data.get('updatedAt') or datetime.now().isoformat(),
        'messages': messages,
        'meta': data.get('meta') or {},
    }


def save_conversation(conv_id, messages):
    config.ensure_data_dirs()
    path = _conversation_path(conv_id)
    existing = None
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            existing = json.load(f)

    record = normalize_conversation(
        {
            'id': conv_id,
            'title': _title_from_messages(messages),
            'createdAt': (existing or {}).get('createdAt') or _parse_legacy_id(conv_id),
            'updatedAt': datetime.now().isoformat(),
            'messages': messages,
            'meta': (existing or {}).get('meta') or {},
        },
        conv_id,
    )
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(record, f, indent=2, ensure_ascii=False)
    return record


def get_conversation(conv_id):
    path = _conversation_path(conv_id)
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return normalize_conversation(data, conv_id)


def list_conversations():
    config.ensure_data_dirs()
    if not os.path.isdir(config.CONVERSATIONS_DIR):
        return []
    conversations = []
    for file in sorted(os.listdir(config.CONVERSATIONS_DIR), reverse=True):
        if not file.endswith('.json'):
            continue
        path = os.path.join(config.CONVERSATIONS_DIR, file)
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        rec = normalize_conversation(data, file[:-5])
        conversations.append({
            'id': rec['id'],
            'title': rec['title'],
            'created': rec['createdAt'],
            'updatedAt': rec.get('updatedAt'),
        })
    return conversations


def delete_conversation(conv_id):
    path = _conversation_path(conv_id)
    if not os.path.exists(path):
        return False
    move_to_trash(path)
    return True


def export_all_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.isdir(config.CONVERSATIONS_DIR):
            for file in os.listdir(config.CONVERSATIONS_DIR):
                if file.endswith('.json'):
                    path = os.path.join(config.CONVERSATIONS_DIR, file)
                    zf.write(path, file)
    buf.seek(0)
    return buf
