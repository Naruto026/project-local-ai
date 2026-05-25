from routes.pages import pages_bp
from routes.health import health_bp
from routes.settings import settings_bp
from routes.models import models_bp
from routes.conversations import conversations_bp
from routes.files import files_bp
from routes.chat import chat_bp


def register_routes(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(models_bp)
    app.register_blueprint(conversations_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(chat_bp)
