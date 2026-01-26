FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p logs staticfiles media

# Gunicorn binds 0.0.0.0 when running in Docker
ENV GUNICORN_BIND=0.0.0.0:8001

EXPOSE 8001

CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn config.wsgi:application -c gunicorn.conf.py
