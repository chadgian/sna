import os
import sqlite3
from contextlib import closing
from flask import Flask, jsonify, render_template, request
import networkx as nx

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "sna.db")
app = Flask(__name__)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with db() as conn:
        conn.executescript("""
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
        """)
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            names = ["Anna", "Ben", "Carlo", "Dana", "Ella", "Frank", "Grace", "Henry"]
            conn.executemany("INSERT INTO users(name) VALUES (?)", [(n,) for n in names])
            ids = {r["name"]: r["id"] for r in conn.execute("SELECT id,name FROM users")}
            pairs = [("Anna","Ben"),("Anna","Carlo"),("Ben","Dana"),("Carlo","Dana"),("Carlo","Ella"),("Dana","Frank"),("Ella","Grace"),("Grace","Henry")]
            conn.executemany("INSERT INTO friendships(user1_id,user2_id) VALUES (?,?)", [tuple(sorted((ids[a], ids[b]))) for a,b in pairs])


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
        return conn.execute("SELECT id,name FROM users WHERE id=?", (uid,)).fetchone()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/graph")
def graph_data():
    g = build_graph()
    nodes = [{"id": n, "label": d["name"], "degree": g.degree(n)} for n,d in g.nodes(data=True)]
    edges = [{"from": a, "to": b} for a,b in g.edges()]
    return jsonify({"nodes": nodes, "edges": edges})


@app.get("/api/users")
def users():
    with db() as conn:
        rows = conn.execute("SELECT id,name,created_at FROM users ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/users")
def add_user():
    name = (request.json or {}).get("name", "").strip()
    if not name:
        return jsonify({"error":"Name is required."}), 400
    try:
        with db() as conn:
            cur = conn.execute("INSERT INTO users(name) VALUES (?)", (name,))
        return jsonify({"id":cur.lastrowid,"name":name}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error":"User already exists."}), 409


@app.delete("/api/users/<int:uid>")
def delete_user(uid):
    with db() as conn:
        cur = conn.execute("DELETE FROM users WHERE id=?", (uid,))
    return (jsonify({"ok":True}) if cur.rowcount else (jsonify({"error":"User not found."}),404))


@app.post("/api/friendships")
def add_friendship():
    data = request.json or {}
    try:
        a,b = int(data.get("user1_id")), int(data.get("user2_id"))
    except (TypeError,ValueError):
        return jsonify({"error":"Two users are required."}),400
    if a == b:
        return jsonify({"error":"A user cannot befriend themselves."}),400
    a,b = sorted((a,b))
    if not user_or_404(a) or not user_or_404(b):
        return jsonify({"error":"User not found."}),404
    try:
        with db() as conn:
            conn.execute("INSERT INTO friendships(user1_id,user2_id) VALUES (?,?)", (a,b))
        return jsonify({"ok":True}),201
    except sqlite3.IntegrityError:
        return jsonify({"error":"Friendship already exists."}),409


@app.delete("/api/friendships")
def delete_friendship():
    data = request.json or {}
    try:
        a,b = sorted((int(data.get("user1_id")), int(data.get("user2_id"))))
    except (TypeError,ValueError):
        return jsonify({"error":"Two users are required."}),400
    with db() as conn:
        cur = conn.execute("DELETE FROM friendships WHERE user1_id=? AND user2_id=?", (a,b))
    return jsonify({"ok":bool(cur.rowcount)})


@app.get("/api/analysis/summary")
def summary():
    g = build_graph()
    if not g:
        return jsonify({"users":0,"friendships":0,"groups":0,"density":0,"most_connected":[]})
    degrees = dict(g.degree())
    max_degree = max(degrees.values(), default=0)
    most = [{"id":n,"name":g.nodes[n]["name"],"degree":d} for n,d in degrees.items() if d == max_degree and max_degree > 0]
    return jsonify({
        "users":g.number_of_nodes(),
        "friendships":g.number_of_edges(),
        "groups":nx.number_connected_components(g),
        "density":round(nx.density(g),3),
        "most_connected":most
    })


@app.get("/api/analysis/mutual/<int:a>/<int:b>")
def mutual(a,b):
    g = build_graph()
    if a not in g or b not in g:
        return jsonify({"error":"User not found."}),404
    common = sorted(nx.common_neighbors(g,a,b), key=lambda n:g.nodes[n]["name"])
    return jsonify([{"id":n,"name":g.nodes[n]["name"]} for n in common])


@app.get("/api/analysis/path/<int:a>/<int:b>")
def path(a,b):
    g = build_graph()
    if a not in g or b not in g:
        return jsonify({"error":"User not found."}),404
    try:
        p = nx.shortest_path(g,a,b)
        return jsonify({"path":[{"id":n,"name":g.nodes[n]["name"]} for n in p],"degrees_of_separation":len(p)-1})
    except nx.NetworkXNoPath:
        return jsonify({"path":[],"degrees_of_separation":None})


@app.get("/api/analysis/components")
def components():
    g = build_graph()
    groups=[]
    for i, comp in enumerate(nx.connected_components(g), start=1):
        groups.append({"group":i,"members":sorted([g.nodes[n]["name"] for n in comp])})
    return jsonify(groups)


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
else:
    init_db()
