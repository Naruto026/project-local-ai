import json
import os
import uuid
from datetime import datetime

import config

active_files = {}


def _meta_path(file_id):
    return os.path.join(config.UPLOADS_DIR, f'{file_id}.meta.json')


def ensure_uploads_dir():
    config.ensure_data_dirs()


def file_limits(settings):
    files_cfg = settings.get('files') or {}
    return {
        'max_files': int(files_cfg.get('maxFiles', 3)),
        'max_upload_mb': int(files_cfg.get('maxUploadMb', 10)),
        'max_context_chars': int(files_cfg.get('maxContextChars', 8000)),
    }


def count_active():
    return len(active_files)


def _save_meta(entry):
    ensure_uploads_dir()
    meta = {
        'id': entry['id'],
        'filename': entry['filename'],
        'extracted_text': entry['extracted_text'],
        'char_count': entry['char_count'],
        'truncated': entry['truncated'],
        'created_at': entry.get('created_at'),
    }
    with open(_meta_path(entry['id']), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False)


def _load_meta(file_id):
    path = _meta_path(file_id)
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    stored_path = data.get('path')
    entry = {
        'id': data['id'],
        'filename': data['filename'],
        'extracted_text': data.get('extracted_text', ''),
        'char_count': data.get('char_count', len(data.get('extracted_text', ''))),
        'truncated': data.get('truncated', False),
        'path': stored_path,
        'created_at': data.get('created_at'),
    }
    active_files[file_id] = entry
    return entry


def get_entries(file_ids):
    entries = []
    for fid in file_ids or []:
        if not fid or str(fid).startswith('pending-'):
            continue
        entry = active_files.get(fid)
        if not entry:
            entry = _load_meta(fid)
        if entry and entry.get('extracted_text'):
            entries.append(entry)
    return entries


def add_file(filename, extracted_text, truncated, path):
    ensure_uploads_dir()
    file_id = str(uuid.uuid4())
    entry = {
        'id': file_id,
        'filename': filename,
        'extracted_text': extracted_text,
        'char_count': len(extracted_text),
        'truncated': truncated,
        'path': path,
        'created_at': datetime.now().isoformat(),
    }
    active_files[file_id] = entry
    meta = {**entry}
    with open(_meta_path(file_id), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False)
    return entry


def remove_file(file_id):
    entry = active_files.pop(file_id, None)
    meta = _meta_path(file_id)
    if os.path.exists(meta):
        try:
            os.remove(meta)
        except OSError:
            pass
    if entry and entry.get('path') and os.path.exists(entry['path']):
        try:
            os.remove(entry['path'])
        except OSError:
            pass
    return entry is not None


def clear_all():
    ids = list(active_files.keys())
    for fid in ids:
        remove_file(fid)


def list_files():
    ensure_uploads_dir()
    result = []
    seen = set()
    for e in active_files.values():
        seen.add(e['id'])
        result.append(_entry_summary(e))
    if os.path.isdir(config.UPLOADS_DIR):
        for name in os.listdir(config.UPLOADS_DIR):
            if name.endswith('.meta.json'):
                fid = name[:-10]
                if fid not in seen:
                    entry = _load_meta(fid)
                    if entry:
                        result.append(_entry_summary(entry))
    return result


def _entry_summary(e):
    return {
        'id': e['id'],
        'filename': e['filename'],
        'charCount': e['char_count'],
        'truncated': e['truncated'],
        'preview': (e.get('extracted_text') or '')[:200],
    }
