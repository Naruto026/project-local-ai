from flask import Blueprint, jsonify, request

from core.session import session
from services.ollama_service import (
    ensure_single_model,
    list_model_names,
    model_base_name,
    unload_model,
)
from storage.settings_store import load_settings
import ollama

models_bp = Blueprint('models', __name__)


@models_bp.route('/models')
def get_models():
    try:
        return jsonify(list_model_names())
    except Exception as e:
        print('MODEL ERROR:', e)
        return jsonify([])


@models_bp.route('/api/models/active', methods=['POST'])
def set_active_model():
    data = request.json or {}
    model = data.get('model', '').strip()
    if not model:
        return jsonify({'error': 'No model'}), 400
    settings = load_settings()
    try:
        ensure_single_model(model, settings)
        session.active_loaded_model = model_base_name(model)
        return jsonify({'model': model, 'loaded': session.active_loaded_model})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@models_bp.route('/api/models/unload', methods=['POST'])
def unload_all_models():
    try:
        running = ollama.ps()
        for entry in running.models:
            name = getattr(entry, 'model', None) or ''
            if name:
                unload_model(model_base_name(name))
        session.active_loaded_model = None
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
