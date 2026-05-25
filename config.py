"""Central paths and defaults — single source of truth for the app."""
import os
from copy import deepcopy

# Project root (directory containing app.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Runtime data (gitignored)
DATA_DIR = os.path.join(BASE_DIR, 'data')
CONVERSATIONS_DIR = os.path.join(DATA_DIR, 'conversations')
UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads')
TRASH_DIR = os.path.join(DATA_DIR, 'trash')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')

# Legacy paths (migrated on startup)
LEGACY_CONVERSATIONS_DIR = os.path.join(BASE_DIR, 'conversations')
LEGACY_UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
LEGACY_SETTINGS_FILE = os.path.join(BASE_DIR, 'settings.json')

DEFAULT_SETTINGS = {
    'model': {
        'keepAlive': '5m',
        'unloadOnSwitch': True,
        'temperature': 0.8,
        'numCtx': 4096,
    },
    'memory': {
        'enabled': True,
        'maxMessages': 40,
        'summarize': False,
        'summarizeThreshold': 24,
    },
    'chat': {
        'streamDelay': 120,
        'greeting': 'Hello! How can I assist you today?',
        'customInstructions': '',
    },
    'appearance': {
        'accentColor': '#10a37f',
        'compactMode': False,
        'animations': True,
    },
    'files': {
        'maxFiles': 3,
        'maxUploadMb': 10,
        'maxContextChars': 8000,
    },
}

CONVERSATION_SCHEMA_VERSION = 2


def ensure_data_dirs():
    for path in (DATA_DIR, CONVERSATIONS_DIR, UPLOADS_DIR, TRASH_DIR):
        os.makedirs(path, exist_ok=True)
