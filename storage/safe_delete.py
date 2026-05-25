"""Move files to recycle bin (Windows-friendly) instead of permanent delete."""
import os
import shutil

import config


def move_to_trash(path):
    """Send a file to system trash, or data/trash fallback."""
    if not path or not os.path.exists(path):
        return False
    try:
        from send2trash import send2trash
        send2trash(path)
        return True
    except ImportError:
        pass
    except Exception as e:
        print('send2trash failed:', e)

    # Fallback: move to local trash folder
    os.makedirs(config.TRASH_DIR, exist_ok=True)
    base = os.path.basename(path)
    dest = os.path.join(config.TRASH_DIR, base)
    if os.path.exists(dest):
        name, ext = os.path.splitext(base)
        dest = os.path.join(config.TRASH_DIR, f'{name}_{os.getpid()}{ext}')
    shutil.move(path, dest)
    return True
