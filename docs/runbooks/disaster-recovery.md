# Disaster Recovery Runbook

## RTO / RPO targets

- **RTO** (recovery time objective): 2 hours
- **RPO** (recovery point objective): up to 24 hours with daily backups; shorter if WAL archiving or managed-DB PITR is enabled

## PostgreSQL backup (managed or self-hosted)

### Manual backup

```bash
pg_dump "$DATABASE_URL" | gzip > "backup_$(date +%Y%m%d).sql.gz"
aws s3 cp "backup_$(date +%Y%m%d).sql.gz" s3://<bucket>/db-backups/
```

### Restore from backup

```bash
aws s3 cp s3://<bucket>/db-backups/backup_YYYYMMDD.sql.gz .
gunzip backup_YYYYMMDD.sql.gz
psql "$DATABASE_URL" -f backup_YYYYMMDD.sql
python manage.py migrate
python manage.py collectstatic --noinput
```

Reconcile migration history with your ops policy (`--fake` only when you fully understand drift).

## Redis

Redis (Celery broker / cache) is typically ephemeral. Tasks may be duplicated or retried after broker loss; tune `CELERY_TASK_ACKS_LATE` and idempotent tasks accordingly.

## Roll back a bad deploy

- Roll the container/host image to the previous known-good revision (Render/Railway/Docker Compose tag).
- If a Django migration shipped with the bad deploy and was applied, coordinate a **backward** migration only with DBA approval and a tested downgrade path.

## Escalation

- Use your on-call channel (e.g. Slack/PagerDuty) and the vendor console for your database host noted in `DATABASE_URL`.
