import os
import sqlite3
from flask import Flask, jsonify, render_template, request
import networkx as nx

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "sna.db"))
app = Flask(__name__)

PROFILE_COLUMNS = {
    "age_group": "TEXT",
    "hometown": "TEXT",
    "occupation": "TEXT",
    "bio": "TEXT",
}


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def clean_text(value, limit=120):
    return str(value or "").strip()[:limit]


def normalize_interests(raw):
    if isinstance(raw, str):
        raw = raw.split(",")
    if not isinstance(raw, list):
        return []
    result, seen = [], set()
    for item in raw:
        value = clean_text(item, 40)
        key = value.casefold()
        if value and key not in seen:
            seen.add(key)
            result.append(value)
        if len(result) >= 12:
            break
    return result


def set_user_interests(conn, user_id, interests):
    conn.execute("DELETE FROM user_interests WHERE user_id=?", (user_id,))
    for interest in normalize_interests(interests):
        conn.execute("INSERT OR IGNORE INTO interests(name) VALUES (?)", (interest,))
        row = conn.execute(
            "SELECT id FROM interests WHERE name=? COLLATE NOCASE", (interest,)
        ).fetchone()
        conn.execute(
            "INSERT OR IGNORE INTO user_interests(user_id, interest_id) VALUES (?,?)",
            (user_id, row["id"]),
        )
    conn.execute(
        "DELETE FROM interests WHERE id NOT IN (SELECT DISTINCT interest_id FROM user_interests)"
    )


def interests_for_user(conn, user_id):
    rows = conn.execute(
        """
        SELECT i.name
        FROM interests i
        JOIN user_interests ui ON ui.interest_id=i.id
        WHERE ui.user_id=?
        ORDER BY i.name COLLATE NOCASE
        """,
        (user_id,),
    ).fetchall()
    return [r["name"] for r in rows]


def serialize_user(conn, row):
    return {
        "id": row["id"],
        "name": row["name"],
        "age_group": row["age_group"] or "",
        "hometown": row["hometown"] or "",
        "occupation": row["occupation"] or "",
        "bio": row["bio"] or "",
        "created_at": row["created_at"],
        "interests": interests_for_user(conn, row["id"]),
    }


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(user2_id) REFERENCES users(id) ON DELETE CASCADE,
                CHECK(user1_id < user2_id),
                UNIQUE(user1_id, user2_id)
            );

            CREATE TABLE IF NOT EXISTS interests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            );

            CREATE TABLE IF NOT EXISTS user_interests (
                user_id INTEGER NOT NULL,
                interest_id INTEGER NOT NULL,
                PRIMARY KEY(user_id, interest_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(interest_id) REFERENCES interests(id) ON DELETE CASCADE
            );
            """
        )

        existing_columns = {
            r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()
        }
        for column, sql_type in PROFILE_COLUMNS.items():
            if column not in existing_columns:
                conn.execute(f"ALTER TABLE users ADD COLUMN {column} {sql_type}")

        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            seed_profiles = [
                ("Anna", "18-24", "Manila", "Student", "Computer science student who enjoys creative projects.", ["Coding", "Music", "Travel"]),
                ("Ben", "18-24", "Manila", "Student", "Enjoys games, sports, and building small apps.", ["Coding", "Gaming", "Basketball"]),
                ("Carlo", "25-34", "Quezon City", "Software Developer", "Software developer interested in intelligent systems.", ["Coding", "Artificial Intelligence", "Photography"]),
                ("Dana", "18-24", "Quezon City", "Graduate Student", "Graduate student interested in technology and books.", ["Artificial Intelligence", "Reading", "Travel"]),
                ("Ella", "25-34", "Cebu City", "Teacher", "Teacher who likes outdoor activities and music.", ["Reading", "Music", "Hiking"]),
                ("Frank", "25-34", "Manila", "Network Engineer", "Network engineer and recreational cyclist.", ["Networking", "Gaming", "Cycling"]),
                ("Grace", "25-34", "Cebu City", "Designer", "Designer who enjoys travel and visual storytelling.", ["Photography", "Travel", "Music"]),
                ("Henry", "35-44", "Davao City", "Researcher", "Researcher focused on computing and lifelong learning.", ["Artificial Intelligence", "Reading", "Hiking"]),
            ]
            for name, age_group, hometown, occupation, bio, interests in seed_profiles:
                cur = conn.execute(
                    """
                    INSERT INTO users(name, age_group, hometown, occupation, bio)
                    VALUES (?,?,?,?,?)
                    """,
                    (name, age_group, hometown, occupation, bio),
                )
                set_user_interests(conn, cur.lastrowid, interests)

            ids = {
                r["name"]: r["id"]
                for r in conn.execute("SELECT id,name FROM users")
            }
            pairs = [
                ("Anna", "Ben"),
                ("Anna", "Carlo"),
                ("Ben", "Dana"),
                ("Carlo", "Dana"),
                ("Carlo", "Ella"),
                ("Dana", "Frank"),
                ("Ella", "Grace"),
                ("Grace", "Henry"),
            ]
            conn.executemany(
                "INSERT INTO friendships(user1_id,user2_id) VALUES (?,?)",
                [tuple(sorted((ids[a], ids[b]))) for a, b in pairs],
            )
        else:
            sample_defaults = [
                ("Anna", "18-24", "Manila", "Student", "Computer science student who enjoys creative projects.", ["Coding", "Music", "Travel"]),
                ("Ben", "18-24", "Manila", "Student", "Enjoys games, sports, and building small apps.", ["Coding", "Gaming", "Basketball"]),
                ("Carlo", "25-34", "Quezon City", "Software Developer", "Software developer interested in intelligent systems.", ["Coding", "Artificial Intelligence", "Photography"]),
                ("Dana", "18-24", "Quezon City", "Graduate Student", "Graduate student interested in technology and books.", ["Artificial Intelligence", "Reading", "Travel"]),
                ("Ella", "25-34", "Cebu City", "Teacher", "Teacher who likes outdoor activities and music.", ["Reading", "Music", "Hiking"]),
                ("Frank", "25-34", "Manila", "Network Engineer", "Network engineer and recreational cyclist.", ["Networking", "Gaming", "Cycling"]),
                ("Grace", "25-34", "Cebu City", "Designer", "Designer who enjoys travel and visual storytelling.", ["Photography", "Travel", "Music"]),
                ("Henry", "35-44", "Davao City", "Researcher", "Researcher focused on computing and lifelong learning.", ["Artificial Intelligence", "Reading", "Hiking"]),
            ]
            for name, age_group, hometown, occupation, bio, interests in sample_defaults:
                row = conn.execute(
                    "SELECT * FROM users WHERE name=? COLLATE NOCASE", (name,)
                ).fetchone()
                if not row:
                    continue
                has_profile = any(
                    clean_text(row[column])
                    for column in ("age_group", "hometown", "occupation", "bio")
                )
                if not has_profile and not interests_for_user(conn, row["id"]):
                    conn.execute(
                        """
                        UPDATE users
                        SET age_group=?, hometown=?, occupation=?, bio=?
                        WHERE id=?
                        """,
                        (age_group, hometown, occupation, bio, row["id"]),
                    )
                    set_user_interests(conn, row["id"], interests)


def build_graph():
    g = nx.Graph()
    with db() as conn:
        for r in conn.execute("SELECT id,name FROM users"):
            g.add_node(r["id"], name=r["name"])
        for r in conn.execute("SELECT user1_id,user2_id FROM friendships"):
            g.add_edge(r["user1_id"], r["user2_id"])
    return g


def user_or_404(uid):
    with db() as conn:
        return conn.execute(
            "SELECT id,name FROM users WHERE id=?", (uid,)
        ).fetchone()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/graph")
def graph_data():
    g = build_graph()
    with db() as conn:
        profiles = {
            r["id"]: serialize_user(conn, r)
            for r in conn.execute("SELECT * FROM users")
        }
    nodes = []
    for n, data in g.nodes(data=True):
        profile = profiles[n]
        nodes.append(
            {
                "id": n,
                "label": data["name"],
                "degree": g.degree(n),
                "age_group": profile["age_group"],
                "hometown": profile["hometown"],
                "occupation": profile["occupation"],
                "interests": profile["interests"],
            }
        )
    edges = [{"from": a, "to": b} for a, b in g.edges()]
    return jsonify({"nodes": nodes, "edges": edges})


@app.get("/api/users")
def users():
    with db() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY name").fetchall()
        return jsonify([serialize_user(conn, r) for r in rows])


@app.get("/api/users/<int:uid>")
def get_user(uid):
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not row:
            return jsonify({"error": "User not found."}), 404
        return jsonify(serialize_user(conn, row))


@app.post("/api/users")
def add_user():
    data = request.json or {}
    name = clean_text(data.get("name"), 80)
    if not name:
        return jsonify({"error": "Name is required."}), 400

    try:
        with db() as conn:
            cur = conn.execute(
                """
                INSERT INTO users(name, age_group, hometown, occupation, bio)
                VALUES (?,?,?,?,?)
                """,
                (
                    name,
                    clean_text(data.get("age_group"), 30),
                    clean_text(data.get("hometown"), 80),
                    clean_text(data.get("occupation"), 80),
                    clean_text(data.get("bio"), 240),
                ),
            )
            set_user_interests(conn, cur.lastrowid, data.get("interests", []))
            row = conn.execute(
                "SELECT * FROM users WHERE id=?", (cur.lastrowid,)
            ).fetchone()
            payload = serialize_user(conn, row)
        return jsonify(payload), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "User already exists."}), 409


@app.put("/api/users/<int:uid>")
def update_user(uid):
    data = request.json or {}
    name = clean_text(data.get("name"), 80)
    if not name:
        return jsonify({"error": "Name is required."}), 400

    try:
        with db() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE id=?", (uid,)
            ).fetchone()
            if not existing:
                return jsonify({"error": "User not found."}), 404
            conn.execute(
                """
                UPDATE users
                SET name=?, age_group=?, hometown=?, occupation=?, bio=?
                WHERE id=?
                """,
                (
                    name,
                    clean_text(data.get("age_group"), 30),
                    clean_text(data.get("hometown"), 80),
                    clean_text(data.get("occupation"), 80),
                    clean_text(data.get("bio"), 240),
                    uid,
                ),
            )
            set_user_interests(conn, uid, data.get("interests", []))
            row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
            payload = serialize_user(conn, row)
        return jsonify(payload)
    except sqlite3.IntegrityError:
        return jsonify({"error": "Another user already uses that name."}), 409


@app.delete("/api/users/<int:uid>")
def delete_user(uid):
    with db() as conn:
        cur = conn.execute("DELETE FROM users WHERE id=?", (uid,))
    return (
        jsonify({"ok": True})
        if cur.rowcount
        else (jsonify({"error": "User not found."}), 404)
    )


@app.post("/api/friendships")
def add_friendship():
    data = request.json or {}
    try:
        a, b = int(data.get("user1_id")), int(data.get("user2_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "Two users are required."}), 400
    if a == b:
        return jsonify({"error": "A user cannot befriend themselves."}), 400
    a, b = sorted((a, b))
    if not user_or_404(a) or not user_or_404(b):
        return jsonify({"error": "User not found."}), 404
    try:
        with db() as conn:
            conn.execute(
                "INSERT INTO friendships(user1_id,user2_id) VALUES (?,?)", (a, b)
            )
        return jsonify({"ok": True}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Friendship already exists."}), 409


@app.delete("/api/friendships")
def delete_friendship():
    data = request.json or {}
    try:
        a, b = sorted(
            (int(data.get("user1_id")), int(data.get("user2_id")))
        )
    except (TypeError, ValueError):
        return jsonify({"error": "Two users are required."}), 400
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM friendships WHERE user1_id=? AND user2_id=?", (a, b)
        )
    return jsonify({"ok": bool(cur.rowcount)})


@app.get("/api/analysis/summary")
def summary():
    g = build_graph()
    if not g:
        return jsonify(
            {
                "users": 0,
                "friendships": 0,
                "groups": 0,
                "density": 0,
                "most_connected": [],
            }
        )
    degrees = dict(g.degree())
    max_degree = max(degrees.values(), default=0)
    most = [
        {"id": n, "name": g.nodes[n]["name"], "degree": d}
        for n, d in degrees.items()
        if d == max_degree and max_degree > 0
    ]
    return jsonify(
        {
            "users": g.number_of_nodes(),
            "friendships": g.number_of_edges(),
            "groups": nx.number_connected_components(g),
            "density": round(nx.density(g), 3),
            "most_connected": most,
        }
    )


@app.get("/api/analysis/mutual/<int:a>/<int:b>")
def mutual(a, b):
    g = build_graph()
    if a not in g or b not in g:
        return jsonify({"error": "User not found."}), 404
    common = sorted(
        nx.common_neighbors(g, a, b), key=lambda n: g.nodes[n]["name"]
    )
    return jsonify(
        [{"id": n, "name": g.nodes[n]["name"]} for n in common]
    )


@app.get("/api/analysis/path/<int:a>/<int:b>")
def path(a, b):
    g = build_graph()
    if a not in g or b not in g:
        return jsonify({"error": "User not found."}), 404
    try:
        p = nx.shortest_path(g, a, b)
        return jsonify(
            {
                "path": [
                    {"id": n, "name": g.nodes[n]["name"]} for n in p
                ],
                "degrees_of_separation": len(p) - 1,
            }
        )
    except nx.NetworkXNoPath:
        return jsonify({"path": [], "degrees_of_separation": None})


@app.get("/api/analysis/components")
def components():
    g = build_graph()
    groups = []
    for i, comp in enumerate(nx.connected_components(g), start=1):
        groups.append(
            {
                "group": i,
                "members": sorted(
                    [g.nodes[n]["name"] for n in comp]
                ),
            }
        )
    return jsonify(groups)


@app.get("/api/analysis/suggestions/<int:uid>")
def suggestions(uid):
    g = build_graph()
    if uid not in g:
        return jsonify({"error": "User not found."}), 404

    with db() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY name").fetchall()
        profiles = {r["id"]: serialize_user(conn, r) for r in rows}

    source = profiles[uid]
    source_interests = {x.casefold(): x for x in source["interests"]}
    friends = set(g.neighbors(uid))
    candidates = []

    for candidate_id, candidate in profiles.items():
        if candidate_id == uid or candidate_id in friends:
            continue

        candidate_interests = {
            x.casefold(): x for x in candidate["interests"]
        }
        shared_keys = set(source_interests) & set(candidate_interests)
        union_keys = set(source_interests) | set(candidate_interests)
        interest_similarity = (
            len(shared_keys) / len(union_keys) if union_keys else 0
        )
        mutual_count = len(set(g.neighbors(uid)) & set(g.neighbors(candidate_id)))
        same_hometown = bool(
            source["hometown"]
            and candidate["hometown"]
            and source["hometown"].casefold() == candidate["hometown"].casefold()
        )
        same_age_group = bool(
            source["age_group"]
            and candidate["age_group"]
            and source["age_group"] == candidate["age_group"]
        )

        score = (
            interest_similarity * 60
            + min(mutual_count, 3) / 3 * 20
            + (10 if same_hometown else 0)
            + (10 if same_age_group else 0)
        )
        if score <= 0:
            continue

        shared_interests = sorted(
            [source_interests[k] for k in shared_keys],
            key=str.casefold,
        )
        reasons = []
        if shared_interests:
            reasons.append(
                f"{len(shared_interests)} shared interest"
                + ("" if len(shared_interests) == 1 else "s")
            )
        if mutual_count:
            reasons.append(
                f"{mutual_count} mutual friend"
                + ("" if mutual_count == 1 else "s")
            )
        if same_hometown:
            reasons.append("same hometown")
        if same_age_group:
            reasons.append("same age group")

        candidates.append(
            {
                "id": candidate_id,
                "name": candidate["name"],
                "score": round(score, 1),
                "shared_interests": shared_interests,
                "mutual_friends": mutual_count,
                "hometown": candidate["hometown"],
                "age_group": candidate["age_group"],
                "occupation": candidate["occupation"],
                "reasons": reasons,
            }
        )

    candidates.sort(key=lambda x: (-x["score"], x["name"].casefold()))
    return jsonify(candidates[:6])


init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
