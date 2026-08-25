# Dynamic Social Network Friend Analyzer

A full-stack MS Computer Science Dynamic Graphs midterm project using **Python/Flask**, **SQLite**, **NetworkX**, **HTML**, **JavaScript**, **Bootstrap 5**, and **vis-network**.

## Features

- Add, edit, and remove user profiles dynamically
- Profile fields: name, age group, hometown, occupation/role, short bio, and interests
- Normalized many-to-many interest storage in SQLite
- Add and remove friendship edges dynamically
- Interactive live social graph visualization with profile tooltips
- Shortest friendship connection using graph shortest-path/BFS behavior
- Mutual-friend detection
- Connected-component / friend-group analysis
- Degree-based most-connected-user analysis
- Graph density, user, friendship, and group statistics
- Hybrid friend recommendations using interests plus graph topology
- One-click connection from a suggestion to create a new friendship edge
- SQLite persistence and automatic schema migration
- Seed data automatically created on first run

## Dynamic Graph Model

The social network is an undirected dynamic graph `G = (V, E)` where users are vertices and friendships are edges. Adding/removing users or friendships changes the topology immediately, after which the analytical results and visualization are recomputed.

Profile attributes are stored as vertex metadata. They do not change graph topology by themselves, but the recommendation algorithm uses them to propose likely new edges. When the user accepts a suggestion, the proposed relationship becomes a real friendship edge in `E` and all graph metrics are recalculated.

## Friend Recommendation Model

For a selected user, current friends and the user themself are excluded. Every remaining candidate receives a score from 0 to 100:

```text
Recommendation Score =
    60% Interest Similarity
  + 20% Mutual-Friend Signal
  + 10% Same Hometown
  + 10% Same Age Group
```

Interest similarity uses **Jaccard similarity**:

```text
J(A,B) = |Interests(A) ∩ Interests(B)| / |Interests(A) ∪ Interests(B)|
```

The mutual-friend signal uses common neighbors in the current graph and is capped at three mutual friends. This makes the recommender a simple hybrid of **content/profile similarity** and **graph topology**.

## SQLite Data Model

```text
users
  id, name, age_group, hometown, occupation, bio, created_at

friendships
  user1_id, user2_id, created_at

interests
  id, name

user_interests
  user_id, interest_id
```

`user_interests` implements a normalized many-to-many relationship so interests can be shared by many profiles without duplicating interest records.

## Project Structure

```text
sna/
├── app.py
├── requirements.txt
├── Dockerfile
├── Procfile
├── test_app.py
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

The SQLite file `sna.db` is generated automatically on first run and populated with sample profiles and friendships.

## Railway Deployment

The repository includes Gunicorn/Docker deployment support and listens on Railway's assigned `$PORT`.

For persistent SQLite storage, mount a Railway volume at `/data` and set:

```text
DB_PATH=/data/sna.db
```

## Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/graph` | Current nodes, edges, and profile tooltip data |
| GET/POST | `/api/users` | List/add profiles |
| GET/PUT/DELETE | `/api/users/<id>` | Read, edit, or delete a profile |
| POST/DELETE | `/api/friendships` | Add/remove friendship |
| GET | `/api/analysis/summary` | Graph metrics |
| GET | `/api/analysis/mutual/<a>/<b>` | Mutual friends |
| GET | `/api/analysis/path/<a>/<b>` | Shortest connection |
| GET | `/api/analysis/components` | Connected groups |
| GET | `/api/analysis/suggestions/<id>` | Hybrid friend recommendations |

## Midterm Demonstration

1. Show the initial graph and inspect a profile.
2. Add a new profile with hometown, age group, and several interests.
3. Run **Suggestions** and explain the similarity score.
4. Accept a recommendation to create a new edge.
5. Run shortest-path and mutual-friend analysis after the new connection.
6. Remove a friendship and show how paths, groups, centrality, and suggestions change.

## Academic Scope

This project focuses on dynamic graph operations, graph analytics, and a small hybrid recommendation model rather than building a production social-media platform. Authentication, posts, messaging, and external social-media integration remain outside the midterm scope.

For classroom demonstrations, use fictional or consented profile data rather than sensitive real-world personal information.
