import json
import logging
import traceback
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log line for structured log ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        log_object: dict = {
            'ts': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'func': record.funcName,
            'line': record.lineno,
        }
        if record.exc_info:
            log_object['exception'] = ''.join(
                traceback.format_exception(*record.exc_info)
            ).strip()
        if hasattr(record, 'request_id'):
            log_object['request_id'] = record.request_id
        return json.dumps(log_object, ensure_ascii=False)
