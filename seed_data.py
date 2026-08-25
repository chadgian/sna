import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "sna.db"))
SEED_VERSION = "50-profiles-v1"

SEED_PROFILES = [('Anna', '18-24', 'Manila', 'Student', 'Computer science student who enjoys creative projects.', ['Coding', 'Music', 'Travel']), ('Ben', '18-24', 'Manila', 'Student', 'Enjoys games, sports, and building small apps.', ['Coding', 'Gaming', 'Basketball']), ('Carlo', '25-34', 'Quezon City', 'Software Developer', 'Software developer interested in intelligent systems.', ['Coding', 'Artificial Intelligence', 'Photography']), ('Dana', '18-24', 'Quezon City', 'Graduate Student', 'Graduate student interested in technology and books.', ['Artificial Intelligence', 'Reading', 'Travel']), ('Ella', '25-34', 'Cebu City', 'Teacher', 'Teacher who likes outdoor activities and music.', ['Reading', 'Music', 'Hiking']), ('Frank', '25-34', 'Manila', 'Network Engineer', 'Network engineer and recreational cyclist.', ['Networking', 'Gaming', 'Cycling']), ('Grace', '25-34', 'Cebu City', 'Designer', 'Designer who enjoys travel and visual storytelling.', ['Photography', 'Travel', 'Music']), ('Henry', '35-44', 'Davao City', 'Researcher', 'Researcher focused on computing and lifelong learning.', ['Artificial Intelligence', 'Reading', 'Hiking']), ('Iris', '18-24', 'Antipolo', 'IT Student', 'IT student exploring mobile apps and digital communities.', ['Coding', 'Mobile Apps', 'Music', 'Gaming']), ('Joel', '25-34', 'Pasig', 'Systems Administrator', 'Systems administrator who enjoys hardware projects and weekend rides.', ['Networking', 'Cybersecurity', 'Cycling', 'Technology']), ('Kara', '18-24', 'Makati', 'Multimedia Student', 'Multimedia student interested in design and online storytelling.', ['Graphic Design', 'Photography', 'Music', 'Social Media']), ('Liam', '25-34', 'Taguig', 'Video Editor', 'Video editor who creates short films and travel reels.', ['Video Editing', 'Photography', 'Travel', 'Movies']), ('Maya', '25-34', 'Quezon City', 'UX Designer', 'UX designer focused on accessible and human-centered products.', ['UX Design', 'Graphic Design', 'Technology', 'Coffee']), ('Nico', '18-24', 'Manila', 'Content Creator', 'Content creator who enjoys music events and street photography.', ['Photography', 'Music', 'Video Editing', 'Social Media']), ('Olivia', '35-44', 'Pasig', 'Marketing Manager', 'Marketing manager interested in brand strategy and community campaigns.', ['Marketing', 'Social Media', 'Travel', 'Reading']), ('Paolo', '25-34', 'Makati', 'Photographer', 'Portrait and event photographer who enjoys exploring new places.', ['Photography', 'Travel', 'Art', 'Coffee']), ('Queenie', '18-24', 'Marikina', 'Fine Arts Student', 'Fine arts student who likes illustration and independent music.', ['Art', 'Illustration', 'Music', 'Graphic Design']), ('Ramon', '35-44', 'Manila', 'Creative Director', 'Creative director working across advertising, design, and digital media.', ['Advertising', 'Graphic Design', 'Photography', 'Movies']), ('Sofia', '25-34', 'Taguig', 'Social Media Specialist', 'Social media specialist who enjoys lifestyle content and travel planning.', ['Social Media', 'Marketing', 'Travel', 'Music']), ('Tristan', '25-34', 'Mandaluyong', 'Motion Designer', 'Motion designer fascinated by animation and visual effects.', ['Animation', 'Graphic Design', 'Video Editing', 'Gaming']), ('Uma', '25-34', 'Baguio', 'Teacher', 'Elementary teacher who enjoys books and mountain walks.', ['Teaching', 'Reading', 'Hiking', 'Education']), ('Victor', '35-44', 'Iloilo City', 'School Administrator', 'School administrator interested in leadership and educational technology.', ['Education', 'Leadership', 'Technology', 'Reading']), ('Wendy', '25-34', 'Bacolod', 'Librarian', 'Librarian who promotes reading clubs and local history.', ['Reading', 'Books', 'History', 'Community Service']), ('Xavier', '35-44', 'Cagayan de Oro', 'University Lecturer', 'Lecturer interested in research methods and data literacy.', ['Research', 'Education', 'Data Science', 'Reading']), ('Yana', '18-24', 'Naga City', 'Education Student', 'Future teacher who volunteers in literacy programs.', ['Teaching', 'Volunteering', 'Reading', 'Children']), ('Zeke', '45-54', 'Dumaguete', 'Professor', 'Professor interested in lifelong learning and public lectures.', ['Research', 'Education', 'History', 'Writing']), ('Bianca', '25-34', 'Cebu City', 'Guidance Counselor', 'Guidance counselor interested in youth development and wellness.', ['Psychology', 'Education', 'Wellness', 'Reading']), ('Cedric', '35-44', 'Tacloban', 'Training Specialist', 'Training specialist who designs professional learning programs.', ['Training', 'Leadership', 'Education', 'Public Speaking']), ('Denise', '25-34', 'General Santos', 'Research Assistant', 'Research assistant working with surveys and community studies.', ['Research', 'Data Analysis', 'Writing', 'Community Service']), ('Ethan', '18-24', 'Davao City', 'Graduate Student', 'Graduate student interested in statistics and academic writing.', ['Research', 'Statistics', 'Reading', 'Data Science']), ('Fiona', '18-24', 'Baguio', 'College Athlete', 'College athlete who spends weekends hiking and running.', ['Running', 'Hiking', 'Fitness', 'Basketball']), ('Gabriel', '25-34', 'Cebu City', 'Fitness Coach', 'Fitness coach who enjoys basketball and beach trips.', ['Fitness', 'Basketball', 'Swimming', 'Travel']), ('Hazel', '25-34', 'Davao City', 'Nurse', 'Nurse who enjoys running, healthy cooking, and nature trips.', ['Running', 'Health', 'Cooking', 'Hiking']), ('Isaac', '35-44', 'Batangas City', 'Physical Therapist', 'Physical therapist interested in mobility, cycling, and wellness.', ['Cycling', 'Fitness', 'Health', 'Sports']), ('Jasmine', '18-24', 'Iloilo City', 'Student Athlete', 'Student athlete active in volleyball and campus organizations.', ['Volleyball', 'Fitness', 'Travel', 'Music']), ('Kyle', '25-34', 'Quezon City', 'Sports Analyst', 'Sports analyst who follows basketball and performance data.', ['Basketball', 'Sports', 'Data Analysis', 'Gaming']), ('Leah', '35-44', 'Tagaytay', 'Outdoor Guide', 'Outdoor guide who leads hiking and camping trips.', ['Hiking', 'Camping', 'Travel', 'Photography']), ('Miguel', '25-34', 'Cagayan de Oro', 'Civil Engineer', 'Engineer who enjoys mountain biking and weekend basketball.', ['Cycling', 'Basketball', 'Engineering', 'Travel']), ('Noelle', '25-34', 'Dumaguete', 'Yoga Instructor', 'Yoga instructor interested in wellness, beaches, and healthy food.', ['Yoga', 'Wellness', 'Health', 'Travel']), ('Owen', '35-44', 'Bacolod', 'PE Teacher', 'Physical education teacher who coaches school sports.', ['Teaching', 'Sports', 'Basketball', 'Fitness']), ('Patricia', '35-44', 'Manila', 'Small Business Owner', 'Runs a neighborhood food business and joins local trade fairs.', ['Entrepreneurship', 'Cooking', 'Community Service', 'Travel']), ('Quentin', '25-34', 'Makati', 'Financial Analyst', 'Financial analyst interested in startups and personal finance.', ['Finance', 'Entrepreneurship', 'Technology', 'Coffee']), ('Rina', '25-34', 'Cebu City', 'Travel Consultant', 'Travel consultant who enjoys food trips and cultural festivals.', ['Travel', 'Food', 'Culture', 'Photography']), ('Samuel', '45-54', 'Quezon City', 'Barangay Program Coordinator', 'Community coordinator working on local youth and safety programs.', ['Community Service', 'Leadership', 'Volunteering', 'Sports']), ('Trisha', '18-24', 'Pasig', 'Hospitality Student', 'Hospitality student interested in events, food, and travel.', ['Hospitality', 'Food', 'Travel', 'Events']), ('Ulysses', '35-44', 'Davao City', 'Architect', 'Architect interested in urban spaces and sustainable design.', ['Architecture', 'Sustainability', 'Travel', 'Photography']), ('Valerie', '25-34', 'Iloilo City', 'Event Organizer', 'Event organizer who works with local businesses and civic groups.', ['Events', 'Community Service', 'Marketing', 'Travel']), ('Warren', '35-44', 'Angeles City', 'Restaurant Manager', 'Restaurant manager who enjoys food innovation and local tourism.', ['Food', 'Entrepreneurship', 'Travel', 'Cooking']), ('Xena', '25-34', 'Naga City', 'NGO Project Officer', 'Project officer supporting livelihood and volunteer initiatives.', ['Volunteering', 'Community Service', 'Leadership', 'Travel']), ('Yosef', '45-54', 'Zamboanga City', 'Business Consultant', 'Business consultant interested in mentoring entrepreneurs and regional travel.', ['Entrepreneurship', 'Leadership', 'Finance', 'Travel'])]

SEED_FRIENDSHIPS = [('Anna', 'Ben'), ('Anna', 'Carlo'), ('Ben', 'Dana'), ('Carlo', 'Dana'), ('Carlo', 'Ella'), ('Dana', 'Frank'), ('Ella', 'Grace'), ('Grace', 'Henry'), ('Anna', 'Iris'), ('Iris', 'Joel'), ('Joel', 'Frank'), ('Joel', 'Henry'), ('Ben', 'Frank'), ('Ella', 'Henry'), ('Grace', 'Iris'), ('Kara', 'Liam'), ('Liam', 'Maya'), ('Maya', 'Nico'), ('Nico', 'Olivia'), ('Olivia', 'Paolo'), ('Paolo', 'Queenie'), ('Queenie', 'Ramon'), ('Ramon', 'Sofia'), ('Sofia', 'Tristan'), ('Tristan', 'Kara'), ('Kara', 'Maya'), ('Nico', 'Paolo'), ('Queenie', 'Sofia'), ('Liam', 'Tristan'), ('Olivia', 'Ramon'), ('Uma', 'Victor'), ('Victor', 'Wendy'), ('Wendy', 'Xavier'), ('Xavier', 'Yana'), ('Yana', 'Zeke'), ('Zeke', 'Bianca'), ('Bianca', 'Cedric'), ('Cedric', 'Denise'), ('Denise', 'Ethan'), ('Ethan', 'Uma'), ('Uma', 'Wendy'), ('Xavier', 'Zeke'), ('Bianca', 'Denise'), ('Victor', 'Cedric'), ('Yana', 'Ethan'), ('Fiona', 'Gabriel'), ('Gabriel', 'Hazel'), ('Hazel', 'Isaac'), ('Isaac', 'Jasmine'), ('Jasmine', 'Kyle'), ('Kyle', 'Leah'), ('Leah', 'Miguel'), ('Miguel', 'Noelle'), ('Noelle', 'Owen'), ('Owen', 'Fiona'), ('Fiona', 'Hazel'), ('Isaac', 'Kyle'), ('Leah', 'Noelle'), ('Gabriel', 'Owen'), ('Jasmine', 'Miguel'), ('Patricia', 'Quentin'), ('Quentin', 'Rina'), ('Rina', 'Samuel'), ('Samuel', 'Trisha'), ('Trisha', 'Ulysses'), ('Ulysses', 'Valerie'), ('Valerie', 'Warren'), ('Warren', 'Xena'), ('Xena', 'Yosef'), ('Yosef', 'Patricia'), ('Patricia', 'Rina'), ('Samuel', 'Ulysses'), ('Valerie', 'Xena'), ('Quentin', 'Yosef'), ('Trisha', 'Warren')]


def connect():
    parent = os.path.dirname(DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def normalize_interests(raw):
    result, seen = [], set()
    for item in raw or []:
        value = str(item or "").strip()[:40]
        key = value.casefold()
        if value and key not in seen:
            seen.add(key)
            result.append(value)
        if len(result) >= 12:
            break
    return result


def ensure_schema(conn):
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

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )

    existing = {
        row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()
    }
    for column in ("age_group", "hometown", "occupation", "bio"):
        if column not in existing:
            conn.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT")


def interests_for_user(conn, user_id):
    rows = conn.execute(
        """
        SELECT i.name
        FROM interests i
        JOIN user_interests ui ON ui.interest_id=i.id
        WHERE ui.user_id=?
        """,
        (user_id,),
    ).fetchall()
    return [row["name"] for row in rows]


def set_interests(conn, user_id, interests):
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


def seed_sample_network():
    with connect() as conn:
        ensure_schema(conn)

        version_row = conn.execute(
            "SELECT value FROM app_meta WHERE key='sample_dataset_version'"
        ).fetchone()
        if version_row and version_row["value"] == SEED_VERSION:
            print("Sample social network already seeded.")
            return

        inserted = 0
        enriched = 0

        for name, age_group, hometown, occupation, bio, interests in SEED_PROFILES:
            row = conn.execute(
                "SELECT * FROM users WHERE name=? COLLATE NOCASE", (name,)
            ).fetchone()

            if row is None:
                cur = conn.execute(
                    """
                    INSERT INTO users(name, age_group, hometown, occupation, bio)
                    VALUES (?,?,?,?,?)
                    """,
                    (name, age_group, hometown, occupation, bio),
                )
                set_interests(conn, cur.lastrowid, interests)
                inserted += 1
                continue

            has_profile = any(
                str(row[column] or "").strip()
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
                set_interests(conn, row["id"], interests)
                enriched += 1

        ids = {
            row["name"]: row["id"]
            for row in conn.execute("SELECT id,name FROM users").fetchall()
        }

        friendship_count = 0
        for left_name, right_name in SEED_FRIENDSHIPS:
            if left_name not in ids or right_name not in ids:
                continue
            left, right = sorted((ids[left_name], ids[right_name]))
            before = conn.total_changes
            conn.execute(
                """
                INSERT OR IGNORE INTO friendships(user1_id,user2_id)
                VALUES (?,?)
                """,
                (left, right),
            )
            if conn.total_changes > before:
                friendship_count += 1

        conn.execute(
            """
            INSERT INTO app_meta(key,value)
            VALUES ('sample_dataset_version',?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
            """,
            (SEED_VERSION,),
        )

        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_friendships = conn.execute(
            "SELECT COUNT(*) FROM friendships"
        ).fetchone()[0]
        print(
            f"Sample network ready: {total_users} users, "
            f"{total_friendships} friendships "
            f"({inserted} profiles added, {enriched} enriched, "
            f"{friendship_count} friendships added)."
        )


if __name__ == "__main__":
    seed_sample_network()
