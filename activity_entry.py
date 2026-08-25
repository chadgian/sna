from app import app, DB_PATH
from activity_log import install_activity_logging

install_activity_logging(app, DB_PATH)
