from datetime import datetime, timedelta, timezone

from app.schemas import LeadIn
from app.storage import LeadStore


NOW = datetime(2026, 8, 24, 1, 0, tzinfo=timezone.utc)


def make_lead() -> LeadIn:
    return LeadIn(
        name="Мария",
        contact="@maria",
        service="S1",
        message="Нужен сайт для груминг-салона с записью",
        budget="100 000 ₽",
        page="/contact",
        consent="on",
        consent_version="1.2-2026-08-24",
        privacy_version="1.2-2026-08-24",
    )


def test_retention_separates_lead_from_consent_receipt(tmp_path):
    store = LeadStore(str(tmp_path / "leads.sqlite3"))
    stored = store.record_lead(
        make_lead(),
        received_at=NOW,
        lead_retention_days=90,
        consent_receipt_retention_days=1095,
        telegram_retry_minutes=15,
        action_text="Даю согласие",
    )
    store.mark_telegram_sent(
        stored.id,
        message_id=42,
        sent_at=NOW,
        retention_hours=24,
    )

    due = store.due_telegram_deletions(now=NOW + timedelta(hours=24))
    assert [(item.lead_id, item.message_id) for item in due] == [(stored.id, 42)]

    deleted_leads, deleted_receipts = store.purge_expired(
        now=NOW + timedelta(days=91)
    )
    assert (deleted_leads, deleted_receipts) == (1, 0)
    assert store.count("leads") == 0
    assert store.count("consent_receipts") == 1
    assert store.count("telegram_deliveries") == 0

    deleted_leads, deleted_receipts = store.purge_expired(
        now=NOW + timedelta(days=1096)
    )
    assert (deleted_leads, deleted_receipts) == (0, 1)


def test_background_retry_cannot_race_the_initial_delivery(tmp_path):
    store = LeadStore(str(tmp_path / "leads.sqlite3"))
    stored = store.record_lead(
        make_lead(),
        received_at=NOW,
        lead_retention_days=90,
        consent_receipt_retention_days=1095,
        telegram_retry_minutes=15,
        action_text="Даю согласие",
    )

    assert store.pending_telegram_leads(now=NOW) == []
    pending = store.pending_telegram_leads(now=NOW + timedelta(minutes=15))
    assert [lead.id for lead in pending] == [stored.id]


def test_sqlite_backup_is_readable(tmp_path):
    store = LeadStore(str(tmp_path / "leads.sqlite3"))
    store.record_lead(
        make_lead(),
        received_at=NOW,
        lead_retention_days=90,
        consent_receipt_retention_days=1095,
        telegram_retry_minutes=15,
        action_text="Даю согласие",
    )

    backup = store.backup(
        str(tmp_path / "backups"),
        now=NOW,
        retention_days=7,
    )
    restored = LeadStore(str(backup))
    assert restored.count("leads") == 1
    assert restored.count("consent_receipts") == 1
