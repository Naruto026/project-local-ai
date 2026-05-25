"""
Local AI Assistant — Flask application entry point.
Run: python app.py
"""
from flask import Flask

import config
from routes import register_routes
from storage.migrate import run_startup_migration


def create_app():
    config.ensure_data_dirs()
    run_startup_migration()

    app = Flask(__name__, template_folder='templates', static_folder='static')
    register_routes(app)
    return app


app = create_app()


if __name__ == '__main__':
    import os
    import threading
    import webbrowser

    def open_browser():
        import urllib.request
        for _ in range(30):
            try:
                urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=1)
                webbrowser.open('http://127.0.0.1:5000')
                return
            except Exception:
                import time
                time.sleep(0.5)

    if os.environ.get('LOCAL_AI_OPEN_BROWSER', '1') == '1':
        threading.Thread(target=open_browser, daemon=True).start()
    # use_reloader=False keeps in-memory uploads; file meta is also persisted to data/uploads/*.meta.json
    app.run(debug=True, threaded=True, use_reloader=False)
