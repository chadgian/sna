import json
import sqlite3
from functools import wraps

from flask import jsonify, request


def connect(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_activity_table(db_path):
    with connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                message TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            );
            CREATE INDEX IF NOT EXISTS idx_activity_log_created
            ON activity_log(created_at DESC, id DESC);
            """
        )


def user_snapshot(db_path, user_id):
    if user_id is None:
        return None
    with connect(db_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not row:
            return None
        interests = [
            r["name"]
            for r in conn.execute(
                """
                SELECT i.name
                FROM interests i
                JOIN user_interests ui ON ui.interest_id=i.id
                WHERE ui.user_id=?
                ORDER BY i.name COLLATE NOCASE
                """,
                (user_id,),
            ).fetchall()
        ]
        return {
            "id": row["id"],
            "name": row["name"],
            "age_group": row["age_group"] or "",
            "hometown": row["hometown"] or "",
            "occupation": row["occupation"] or "",
            "bio": row["bio"] or "",
            "interests": interests,
        }


def user_name(db_path, user_id):
    if user_id is None:
        return None
    with connect(db_path) as conn:
        row = conn.execute("SELECT name FROM users WHERE id=?", (user_id,)).fetchone()
        return row["name"] if row else None


def add_activity(db_path, action_type, message, metadata=None):
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO activity_log(action_type,message,metadata) VALUES (?,?,?)",
            (
                str(action_type)[:40],
                str(message)[:600],
                json.dumps(metadata or {}, ensure_ascii=False)[:2000],
            ),
        )
        conn.execute(
            """
            DELETE FROM activity_log
            WHERE id NOT IN (
                SELECT id FROM activity_log ORDER BY id DESC LIMIT 300
            )
            """
        )


def profile_change_message(before, after):
    if not before or not after:
        return None

    changes = []
    labels = {
        "name": "name",
        "age_group": "age group",
        "hometown": "hometown",
        "occupation": "occupation/role",
        "bio": "bio",
    }
    for key, label in labels.items():
        old = (before.get(key) or "").strip()
        new = (after.get(key) or "").strip()
        if old == new:
            continue
        if key == "bio":
            changes.append("updated bio")
        elif not old:
            changes.append(f"added {label}: {new}")
        elif not new:
            changes.append(f"removed {label}")
        else:
            changes.append(f"changed {label} to {new}")

    old_map = {x.casefold(): x for x in before.get("interests", [])}
    new_map = {x.casefold(): x for x in after.get("interests", [])}
    added = [new_map[k] for k in sorted(set(new_map) - set(old_map))]
    removed = [old_map[k] for k in sorted(set(old_map) - set(new_map))]
    if added:
        changes.append("added interests: " + ", ".join(added))
    if removed:
        changes.append("removed interests: " + ", ".join(removed))

    if not changes:
        return None
    return f"Updated {after['name']}: " + "; ".join(changes)


def install_activity_logging(app, db_path):
    if app.config.get("ACTIVITY_LOG_INSTALLED"):
        return
    app.config["ACTIVITY_LOG_INSTALLED"] = True
    ensure_activity_table(db_path)

    @app.get("/api/activities")
    def recent_activities():
        try:
            limit = int(request.args.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 100))
        with connect(db_path) as conn:
            rows = conn.execute(
                """
                SELECT id,action_type,message,metadata,created_at
                FROM activity_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        result = []
        for row in rows:
            try:
                metadata = json.loads(row["metadata"] or "{}")
            except json.JSONDecodeError:
                metadata = {}
            result.append(
                {
                    "id": row["id"],
                    "type": row["action_type"],
                    "message": row["message"],
                    "metadata": metadata,
                    "created_at": row["created_at"],
                }
            )
        return jsonify(result)

    original_add_user = app.view_functions.get("add_user")
    if original_add_user:
        @wraps(original_add_user)
        def logged_add_user():
            response = app.make_response(original_add_user())
            if 200 <= response.status_code < 300:
                data = response.get_json(silent=True) or {}
                snapshot = user_snapshot(db_path, data.get("id"))
                if snapshot:
                    details = []
                    if snapshot["interests"]:
                        details.append("interests: " + ", ".join(snapshot["interests"]))
                    suffix = f" ({'; '.join(details)})" if details else ""
                    add_activity(
                        db_path,
                        "profile_added",
                        f"Added profile for {snapshot['name']}{suffix}.",
                        {"user_id": snapshot["id"]},
                    )
            return response
        app.view_functions["add_user"] = logged_add_user

    original_update_user = app.view_functions.get("update_user")
    if original_update_user:
        @wraps(original_update_user)
        def logged_update_user(uid):
            before = user_snapshot(db_path, uid)
            response = app.make_response(original_update_user(uid))
            if 200 <= response.status_code < 300:
                after = user_snapshot(db_path, uid)
                message = profile_change_message(before, after)
                if message:
                    add_activity(
                        db_path,
                        "profile_updated",
                        message,
                        {"user_id": uid},
                    )
            return response
        app.view_functions["update_user"] = logged_update_user

    original_delete_user = app.view_functions.get("delete_user")
    if original_delete_user:
        @wraps(original_delete_user)
        def logged_delete_user(uid):
            before = user_snapshot(db_path, uid)
            response = app.make_response(original_delete_user(uid))
            if before and 200 <= response.status_code < 300:
                add_activity(
                    db_path,
                    "profile_removed",
                    f"Removed profile {before['name']} and its associated friendships.",
                    {"user_id": uid},
                )
            return response
        app.view_functions["delete_user"] = logged_delete_user

    original_add_friendship = app.view_functions.get("add_friendship")
    if original_add_friendship:
        @wraps(original_add_friendship)
        def logged_add_friendship():
            payload = request.get_json(silent=True) or {}
            try:
                a, b = int(payload.get("user1_id")), int(payload.get("user2_id"))
            except (TypeError, ValueError):
                a = b = None
            name_a, name_b = user_name(db_path, a), user_name(db_path, b)
            response = app.make_response(original_add_friendship())
            if name_a and name_b and 200 <= response.status_code < 300:
                add_activity(
                    db_path,
                    "friendship_added",
                    f"Connected {name_a} and {name_b} as friends.",
                    {"user1_id": a, "user2_id": b},
                )
            return response
        app.view_functions["add_friendship"] = logged_add_friendship

    original_delete_friendship = app.view_functions.get("delete_friendship")
    if original_delete_friendship:
        @wraps(original_delete_friendship)
        def logged_delete_friendship():
            payload = request.get_json(silent=True) or {}
            try:
                a, b = int(payload.get("user1_id")), int(payload.get("user2_id"))
            except (TypeError, ValueError):
                a = b = None
            name_a, name_b = user_name(db_path, a), user_name(db_path, b)
            response = app.make_response(original_delete_friendship())
            body = response.get_json(silent=True) or {}
            if name_a and name_b and body.get("ok"):
                add_activity(
                    db_path,
                    "friendship_removed",
                    f"Disconnected {name_a} and {name_b}; they are no longer friends.",
                    {"user1_id": a, "user2_id": b},
                )
            return response
        app.view_functions["delete_friendship"] = logged_delete_friendship
