FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "python seed_data.py && exec gunicorn activity_entry:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 2 --timeout 60"]
