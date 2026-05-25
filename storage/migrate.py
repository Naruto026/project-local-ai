"""One-time migration from legacy folders to data/."""
import os
import shutil

import config


def _migrate_dir(src, dest):
    if not os.path.isdir(src):
        return
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(src):
        src_path = os.path.join(src, name)
        dest_path = os.path.join(dest, name)
        if os.path.isfile(src_path) and not os.path.exists(dest_path):
            shutil.copy2(src_path, dest_path)


def run_startup_migration():
    config.ensure_data_dirs()
    _migrate_dir(config.LEGACY_CONVERSATIONS_DIR, config.CONVERSATIONS_DIR)
    _migrate_dir(config.LEGACY_UPLOADS_DIR, config.UPLOADS_DIR)
    if os.path.isfile(config.LEGACY_SETTINGS_FILE) and not os.path.isfile(config.SETTINGS_FILE):
        shutil.copy2(config.LEGACY_SETTINGS_FILE, config.SETTINGS_FILE)
