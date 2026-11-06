"""One-off migration for inquiry replies.

`Base.metadata.create_all()` in app/main.py creates missing tables but never adds
columns to tables that already exist, so `contact_messages.sender_user_id` has to
be added explicitly. Idempotent: safe to run more than once.

Run from the backend/ directory:  python migrate_inquiry_replies.py
"""

from sqlalchemy import text

from app.db.database import engine
from app.db import models  # noqa: F401  (registers the tables on Base.metadata)

STATEMENTS = [
    # Links an inquiry to the account that sent it. NULL = guest inquiry.
    """
    ALTER TABLE contact_messages
    ADD COLUMN IF NOT EXISTS sender_user_id INTEGER REFERENCES users(id)
    """,
    "CREATE INDEX IF NOT EXISTS ix_contact_messages_sender_user_id ON contact_messages (sender_user_id)",
    """
    CREATE TABLE IF NOT EXISTS message_replies (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
        sender_user_id INTEGER NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_message_replies_message_id ON message_replies (message_id)",
]


def main():
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
            print(f"ok: {' '.join(stmt.split())[:70]}")

    # Column added outside create_all, so refresh the model metadata view.
    models.Base.metadata.create_all(bind=engine)
    print("migration complete")


if __name__ == "__main__":
    main()
