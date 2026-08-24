from collections import defaultdict, deque


class RateLimiter:
    """Скользящее окно в памяти. Без базы: перезапуск сбрасывает счётчики,
    и это приемлемо — защита от потока, а не от целенаправленной атаки."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float) -> bool:
        hits = self._hits[key]
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            return False
        hits.append(now)
        return True

    def purge(self, now: float) -> int:
        """Удаляет адреса, по которым истекло всё скользящее окно."""
        expired = []
        for key, hits in self._hits.items():
            while hits and now - hits[0] >= self._window:
                hits.popleft()
            if not hits:
                expired.append(key)
        for key in expired:
            del self._hits[key]
        return len(expired)
