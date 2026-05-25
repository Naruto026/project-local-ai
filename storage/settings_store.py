import json
import os
from copy import deepcopy

import config


def load_settings():
    path = config.SETTINGS_FILE
    if not os.path.exists(path) and os.path.exists(config.LEGACY_SETTINGS_FILE):
        path = config.LEGACY_SETTINGS_FILE
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        merged = deepcopy(config.DEFAULT_SETTINGS)
        for section, values in data.items():
            if section in merged and isinstance(values, dict):
                merged[section].update(values)
        return merged
    return deepcopy(config.DEFAULT_SETTINGS)


def save_settings(data):
    config.ensure_data_dirs()
    with open(config.SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
