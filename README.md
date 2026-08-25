# Dynamic Social Network Friend Analyzer

A full-stack MS Computer Science Dynamic Graphs midterm project using **Python/Flask**, **SQLite**, **NetworkX**, **HTML**, **JavaScript**, **Bootstrap 5**, and **vis-network**.

## Features

- Add and remove users dynamically
- Add and remove friendship edges dynamically
- Interactive live social graph visualization
- Shortest friendship connection using graph shortest-path/BFS behavior
- Mutual-friend detection
- Connected-component / friend-group analysis
- Degree-based most-connected-user analysis
- Graph density, user, friendship, and group statistics
- SQLite persistence
- Seed data automatically created on first run

## Dynamic Graph Model

The social network is an undirected dynamic graph `G = (V, E)` where users are vertices and friendships are edges. Adding/removing users or friendships changes the topology immediately, after which the analytical results and visualization are recomputed.

## Project Structure

```text
sna/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
└── .gitignore
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/chadgian/sna.git
   cd sna
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   ```
   Windows:
   ```bash
   .venv\Scripts\activate
   ```
   macOS/Linux:
   ```bash
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the system:
   ```bash
   python app.py
   ```
5. Open `http://127.0.0.1:5000` in a browser.

The SQLite file `sna.db` is generated automatically on first run and populated with sample users/friendships.

## Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/graph` | Current nodes and edges |
| GET/POST | `/api/users` | List/add users |
| DELETE | `/api/users/<id>` | Delete user |
| POST/DELETE | `/api/friendships` | Add/remove friendship |
| GET | `/api/analysis/summary` | Graph metrics |
| GET | `/api/analysis/mutual/<a>/<b>` | Mutual friends |
| GET | `/api/analysis/path/<a>/<b>` | Shortest connection |
| GET | `/api/analysis/components` | Connected groups |

## Midterm Demonstration

1. Show the initial graph.
2. Add a new user (new vertex).
3. Add a friendship (new edge).
4. Run shortest-connection analysis.
5. Remove a friendship and rerun the analysis to show the graph/path changing.
6. Compare connected groups and most-connected users before and after the graph update.

## Academic Scope

This project focuses on dynamic graph operations and graph analytics rather than building a production social-media platform. Authentication, posts, messaging, and external social-media integration are intentionally outside the midterm scope.
