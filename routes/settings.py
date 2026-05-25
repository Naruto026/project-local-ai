from flask import Blueprint, jsonify, request

from storage.settings_store import load_settings, save_settings

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/api/settings', methods=['GET'])
def api_get_settings():
    return jsonify(load_settings())


@settings_bp.route('/api/settings', methods=['POST'])
def api_save_settings():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid settings'}), 400
    try:
        merged = load_settings()
        for section, values in data.items():
            if section in merged and isinstance(values, dict):
                merged[section].update(values)
        save_settings(merged)
        return jsonify(merged)
    except OSError as e:
        return jsonify({'error': str(e)}), 500
