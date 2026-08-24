from app.ratelimit import RateLimiter


def test_allows_up_to_limit():
    rl = RateLimiter(limit=3, window_seconds=3600)
    assert rl.allow("1.2.3.4", now=1000.0)
    assert rl.allow("1.2.3.4", now=1001.0)
    assert rl.allow("1.2.3.4", now=1002.0)


def test_blocks_over_limit():
    rl = RateLimiter(limit=2, window_seconds=3600)
    rl.allow("1.2.3.4", now=1000.0)
    rl.allow("1.2.3.4", now=1001.0)
    assert rl.allow("1.2.3.4", now=1002.0) is False


def test_window_slides():
    rl = RateLimiter(limit=1, window_seconds=60)
    assert rl.allow("1.2.3.4", now=1000.0)
    assert rl.allow("1.2.3.4", now=1030.0) is False
    assert rl.allow("1.2.3.4", now=1061.0) is True


def test_addresses_are_independent():
    rl = RateLimiter(limit=1, window_seconds=60)
    assert rl.allow("1.1.1.1", now=1000.0)
    assert rl.allow("2.2.2.2", now=1000.0)


def test_purge_removes_addresses_after_the_window():
    rl = RateLimiter(limit=1, window_seconds=60)
    assert rl.allow("1.2.3.4", now=1000.0)
    assert rl.purge(now=1059.0) == 0
    assert rl.purge(now=1060.0) == 1
