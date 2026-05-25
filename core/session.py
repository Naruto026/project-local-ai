"""In-memory session state for the active chat (single-user local app)."""


class SessionState:
    def __init__(self):
        self.conversation_id = None
        self.chat_history = []
        self.active_loaded_model = None

    def reset_chat(self):
        self.conversation_id = None
        self.chat_history = []

    def clear_history(self):
        self.chat_history = []


session = SessionState()
