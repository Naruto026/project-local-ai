from flask import Blueprint, jsonify
import ollama

from services.extract.ocr import tesseract_available

health_bp = Blueprint('health', __name__)


@health_bp.route('/api/health')
def health():
    ollama_ok = False
    try:
        ollama.list()
        ollama_ok = True
    except Exception:
        pass
    return jsonify({
        'ok': True,
        'ollama': ollama_ok,
        'tesseract': tesseract_available(),
    })
