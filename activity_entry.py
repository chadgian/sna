from flask import render_template

from app import app, DB_PATH
from activity_log import install_activity_logging

install_activity_logging(app, DB_PATH)


@app.get("/system-guide")
def system_guide():
    return render_template("system_guide.html")
