FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — never run production containers as root
RUN adduser --disabled-password --gecos '' appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && mkdir -p logs staticfiles media/exports \
    && chmod +x /app/docker-entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

ENV GUNICORN_BIND=0.0.0.0:8001

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/healthz/')" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
