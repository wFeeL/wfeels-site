from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime

from .config import Settings
from .ratelimit import RateLimiter
from .storage import LeadStore, StoredLead, utc_now
from .telegram import TelegramDelivery

log = logging.getLogger(__name__)

Sender = Callable[[str], Awaitable[TelegramDelivery | None]]
Deleter = Callable[[int], Awaitable[bool]]
Formatter = Callable[[StoredLead], str]


async def deliver_pending(
    store: LeadStore,
    *,
    sender: Sender,
    formatter: Formatter,
    config: Settings,
    now: datetime,
) -> None:
    for lead in store.pending_telegram_leads(now=now):
        try:
            delivery = await sender(formatter(lead))
        except Exception as exc:
            delivery = None
            error_code = type(exc).__name__
        else:
            error_code = "delivery_failed"

        if delivery is None:
            store.mark_telegram_retry(
                lead.id,
                now=now,
                retry_minutes=config.telegram_retry_minutes,
                error_code=error_code,
            )
            continue

        store.mark_telegram_sent(
            lead.id,
            message_id=delivery.message_id,
            sent_at=now,
            retention_hours=config.telegram_retention_hours,
        )


async def delete_expired_telegram_copies(
    store: LeadStore,
    *,
    deleter: Deleter,
    now: datetime,
) -> None:
    for message in store.due_telegram_deletions(now=now):
        try:
            deleted = await deleter(message.message_id)
        except Exception as exc:
            log.error(
                "Ошибка удаления Telegram-копии: %s",
                type(exc).__name__,
            )
            deleted = False
        if deleted:
            store.mark_telegram_deleted(message.lead_id, deleted_at=now)


async def maintenance_loop(
    store: LeadStore,
    *,
    sender: Sender,
    deleter: Deleter,
    formatter: Formatter,
    config: Settings,
    rate_limiter: RateLimiter,
) -> None:
    last_backup: datetime | None = None
    while True:
        now = utc_now()
        try:
            await deliver_pending(
                store,
                sender=sender,
                formatter=formatter,
                config=config,
                now=now,
            )
            await delete_expired_telegram_copies(
                store,
                deleter=deleter,
                now=now,
            )
            store.purge_expired(now=now)
            rate_limiter.purge(now.timestamp())

            backup_due = (
                config.backup_directory
                and (
                    last_backup is None
                    or (now - last_backup).total_seconds()
                    >= config.backup_interval_hours * 3600
                )
            )
            if backup_due:
                store.backup(
                    config.backup_directory,
                    now=now,
                    retention_days=config.backup_retention_days,
                )
                last_backup = now
        except Exception as exc:
            # Ни данные заявки, ни текст внешней ошибки в журнал не попадают.
            log.error("Ошибка обслуживания базы заявок: %s", type(exc).__name__)

        await asyncio.sleep(config.maintenance_interval_seconds)
