from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from .schemas import LeadIn


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc_text(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


@dataclass(frozen=True)
class StoredLead:
    id: str
    name: str
    contact: str
    service: str
    message: str
    budget: str | None
    page: str


@dataclass(frozen=True)
class TelegramMessage:
    lead_id: str
    message_id: int


class LeadStore:
    """Небольшая первичная база заявок на российском VPS.

    Соединение одно на процесс и защищено блокировкой: обработчики FastAPI и
    фоновое обслуживание могут обращаться к нему из разных потоков. В БД не
    записывается IP-адрес посетителя и не попадают тексты ошибок внешних
    сервисов.
    """

    def __init__(self, path: str):
        self.path = path
        self._lock = threading.RLock()
        self._connection: sqlite3.Connection | None = None

    def _connect(self) -> sqlite3.Connection:
        with self._lock:
            if self._connection is not None:
                return self._connection

            if self.path != ":memory:":
                parent = Path(self.path).parent
                parent.mkdir(parents=True, exist_ok=True)
                parent.chmod(0o700)

            connection = sqlite3.connect(
                self.path,
                check_same_thread=False,
                timeout=5,
            )
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA busy_timeout = 5000")
            if self.path != ":memory:":
                connection.execute("PRAGMA journal_mode = WAL")
                connection.execute("PRAGMA synchronous = FULL")
                Path(self.path).chmod(0o600)
            self._migrate(connection)
            self._connection = connection
            return connection

    @staticmethod
    def _migrate(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                received_at TEXT NOT NULL,
                retention_until TEXT NOT NULL,
                name TEXT NOT NULL,
                contact TEXT NOT NULL,
                service TEXT NOT NULL,
                message TEXT NOT NULL,
                budget TEXT,
                page TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS consent_receipts (
                lead_id TEXT PRIMARY KEY,
                received_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                contact TEXT NOT NULL,
                source_page TEXT NOT NULL,
                consent_version TEXT NOT NULL,
                privacy_version TEXT NOT NULL,
                action_text TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS telegram_deliveries (
                lead_id TEXT PRIMARY KEY,
                status TEXT NOT NULL CHECK (
                    status IN ('pending', 'sent', 'deleted')
                ),
                attempt_count INTEGER NOT NULL DEFAULT 0,
                next_attempt_at TEXT NOT NULL,
                message_id INTEGER,
                sent_at TEXT,
                delete_after TEXT,
                deleted_at TEXT,
                last_error_code TEXT
            );

            CREATE INDEX IF NOT EXISTS leads_retention_idx
                ON leads(retention_until);
            CREATE INDEX IF NOT EXISTS consent_receipts_expiry_idx
                ON consent_receipts(expires_at);
            CREATE INDEX IF NOT EXISTS telegram_pending_idx
                ON telegram_deliveries(status, next_attempt_at);
            CREATE INDEX IF NOT EXISTS telegram_delete_idx
                ON telegram_deliveries(status, delete_after);
            """
        )
        connection.commit()

    def record_lead(
        self,
        lead: LeadIn,
        *,
        received_at: datetime,
        lead_retention_days: int,
        consent_receipt_retention_days: int,
        telegram_retry_minutes: int,
        action_text: str,
    ) -> StoredLead:
        lead_id = uuid4().hex
        received = as_utc_text(received_at)
        retention_until = as_utc_text(
            received_at + timedelta(days=lead_retention_days)
        )
        receipt_expires = as_utc_text(
            received_at + timedelta(days=consent_receipt_retention_days)
        )
        # Первую отправку выполняет HTTP-обработчик сразу после COMMIT. Фоновый
        # цикл получает запись только через интервал повтора: если дать ему
        # `received_at`, он может подобрать ту же заявку между COMMIT и ответом
        # Telegram и отправить второй экземпляр.
        first_retry_at = as_utc_text(
            received_at + timedelta(minutes=telegram_retry_minutes)
        )

        with self._lock:
            connection = self._connect()
            with connection:
                connection.execute(
                    """
                    INSERT INTO leads (
                        id, received_at, retention_until, name, contact,
                        service, message, budget, page
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        lead_id,
                        received,
                        retention_until,
                        lead.name,
                        lead.contact,
                        lead.service,
                        lead.message,
                        lead.budget,
                        lead.page,
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO consent_receipts (
                        lead_id, received_at, expires_at, contact, source_page,
                        consent_version, privacy_version, action_text
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        lead_id,
                        received,
                        receipt_expires,
                        lead.contact,
                        lead.page,
                        lead.consent_version,
                        lead.privacy_version,
                        action_text,
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO telegram_deliveries (
                        lead_id, status, next_attempt_at
                    ) VALUES (?, 'pending', ?)
                    """,
                    (lead_id, first_retry_at),
                )

        return StoredLead(
            id=lead_id,
            name=lead.name,
            contact=lead.contact,
            service=lead.service,
            message=lead.message,
            budget=lead.budget,
            page=lead.page,
        )

    def mark_telegram_sent(
        self,
        lead_id: str,
        *,
        message_id: int,
        sent_at: datetime,
        retention_hours: int,
    ) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE telegram_deliveries
                   SET status = 'sent', attempt_count = attempt_count + 1,
                       message_id = ?, sent_at = ?, delete_after = ?,
                       last_error_code = NULL
                 WHERE lead_id = ?
                """,
                (
                    message_id,
                    as_utc_text(sent_at),
                    as_utc_text(sent_at + timedelta(hours=retention_hours)),
                    lead_id,
                ),
            )

    def mark_telegram_retry(
        self,
        lead_id: str,
        *,
        now: datetime,
        retry_minutes: int,
        error_code: str,
    ) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE telegram_deliveries
                   SET status = 'pending', attempt_count = attempt_count + 1,
                       next_attempt_at = ?, last_error_code = ?
                 WHERE lead_id = ?
                """,
                (
                    as_utc_text(now + timedelta(minutes=retry_minutes)),
                    error_code[:80],
                    lead_id,
                ),
            )

    def pending_telegram_leads(
        self,
        *,
        now: datetime,
        limit: int = 25,
    ) -> list[StoredLead]:
        with self._lock:
            rows = self._connect().execute(
                """
                SELECT l.id, l.name, l.contact, l.service, l.message,
                       l.budget, l.page
                  FROM telegram_deliveries AS d
                  JOIN leads AS l ON l.id = d.lead_id
                 WHERE d.status = 'pending' AND d.next_attempt_at <= ?
                 ORDER BY d.next_attempt_at, l.received_at
                 LIMIT ?
                """,
                (as_utc_text(now), limit),
            ).fetchall()
        return [StoredLead(**dict(row)) for row in rows]

    def due_telegram_deletions(
        self,
        *,
        now: datetime,
        limit: int = 50,
    ) -> list[TelegramMessage]:
        with self._lock:
            rows = self._connect().execute(
                """
                SELECT lead_id, message_id
                  FROM telegram_deliveries
                 WHERE status = 'sent' AND delete_after <= ?
                       AND message_id IS NOT NULL
                 ORDER BY delete_after
                 LIMIT ?
                """,
                (as_utc_text(now), limit),
            ).fetchall()
        return [TelegramMessage(**dict(row)) for row in rows]

    def mark_telegram_deleted(self, lead_id: str, *, deleted_at: datetime) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE telegram_deliveries
                   SET status = 'deleted', deleted_at = ?,
                       last_error_code = NULL
                 WHERE lead_id = ?
                """,
                (as_utc_text(deleted_at), lead_id),
            )

    def purge_expired(self, *, now: datetime) -> tuple[int, int]:
        now_text = as_utc_text(now)
        with self._lock, self._connect() as connection:
            # Статус доставки нужен только пока существует сама заявка. Без
            # явного удаления эта техническая строка оставалась бы навсегда:
            # внешнего ключа на `leads` здесь намеренно нет, потому что
            # доказательство согласия живёт дольше самой заявки.
            connection.execute(
                """
                DELETE FROM telegram_deliveries
                 WHERE lead_id IN (
                       SELECT id FROM leads WHERE retention_until <= ?
                 )
                """,
                (now_text,),
            )
            leads = connection.execute(
                "DELETE FROM leads WHERE retention_until <= ?",
                (now_text,),
            ).rowcount
            receipts = connection.execute(
                "DELETE FROM consent_receipts WHERE expires_at <= ?",
                (now_text,),
            ).rowcount
        return leads, receipts

    def backup(self, directory: str, *, now: datetime, retention_days: int) -> Path:
        target_dir = Path(directory)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_dir.chmod(0o700)
        target = target_dir / f"leads-{now.astimezone(timezone.utc):%Y%m%dT%H%M%SZ}.sqlite3"

        with self._lock:
            source = self._connect()
            destination = sqlite3.connect(target)
            try:
                source.backup(destination)
            finally:
                destination.close()
        target.chmod(0o600)

        cutoff = now - timedelta(days=retention_days)
        for candidate in target_dir.glob("leads-*.sqlite3"):
            modified = datetime.fromtimestamp(candidate.stat().st_mtime, timezone.utc)
            if modified < cutoff:
                candidate.unlink()
        return target

    def count(self, table: str) -> int:
        if table not in {"leads", "consent_receipts", "telegram_deliveries"}:
            raise ValueError("unknown table")
        with self._lock:
            row = self._connect().execute(
                f"SELECT COUNT(*) AS total FROM {table}"
            ).fetchone()
        return int(row["total"])

    def close(self) -> None:
        with self._lock:
            if self._connection is not None:
                self._connection.close()
                self._connection = None
