import os
import uuid

from flask import Blueprint, jsonify, request

from services.extract import extract_file, FileExtractError
from services.file_store import (
    add_file,
    remove_file,
    clear_all,
    count_active,
    list_files,
    file_limits,
    ensure_uploads_dir,
)
from services.text_utils import truncate_text
from storage.settings_store import load_settings
import config

files_bp = Blueprint('files', __name__)


@files_bp.route('/api/files', methods=['GET'])
def api_list_files():
    return jsonify(list_files())


@files_bp.route('/api/files/upload', methods=['POST'])
def api_upload_file():
    settings = load_settings()
    limits = file_limits(settings)

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    upload = request.files['file']
    if not upload.filename:
        return jsonify({'error': 'Empty filename'}), 400

    if count_active() >= limits['max_files']:
        return jsonify({
            'error': f'Maximum {limits["max_files"]} files attached. Remove one to add another.',
        }), 400

    upload.seek(0, os.SEEK_END)
    size = upload.tell()
    upload.seek(0)
    max_bytes = limits['max_upload_mb'] * 1024 * 1024
    if size > max_bytes:
        return jsonify({
            'error': f'File too large (max {limits["max_upload_mb"]} MB per file).',
        }), 400

    ext = os.path.splitext(upload.filename)[1].lower()
    safe_name = f'{uuid.uuid4().hex}{ext}'
    ensure_uploads_dir()
    path = os.path.join(config.UPLOADS_DIR, safe_name)

    try:
        upload.save(path)
        raw_text = extract_file(path, upload.filename)
        store_cap = limits['max_context_chars'] * 2
        stored_text, truncated = truncate_text(raw_text, store_cap)
        entry = add_file(upload.filename, stored_text, truncated, path)
        return jsonify({
            'id': entry['id'],
            'filename': entry['filename'],
            'charCount': entry['char_count'],
            'truncated': entry['truncated'],
            'preview': stored_text[:200],
        })
    except FileExtractError as e:
        if os.path.exists(path):
            os.remove(path)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        if os.path.exists(path):
            os.remove(path)
        print('UPLOAD ERROR:', e)
        return jsonify({'error': 'Failed to process file.'}), 500


@files_bp.route('/api/files/<file_id>', methods=['DELETE'])
def api_delete_file(file_id):
    if remove_file(file_id):
        return jsonify({'success': True})
    return jsonify({'error': 'File not found'}), 404


@files_bp.route('/api/files/clear', methods=['POST'])
def api_clear_files():
    clear_all()
    return jsonify({'success': True})
