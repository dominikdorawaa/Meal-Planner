package com.mealplanner.server.off;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class LookupLimitsTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-16T12:00:00Z"));

    private void advance(Duration duration) {
        now.set(now.get().plus(duration));
    }

    @Test
    void limiterAllowsRequestsUpToTheLimitPerWindow() {
        RequestLimiter limiter = new RequestLimiter(2, Duration.ofMinutes(1), now::get);

        assertThat(limiter.tryAcquire()).isTrue();
        advance(Duration.ofSeconds(30));
        assertThat(limiter.tryAcquire()).isTrue();
        assertThat(limiter.tryAcquire()).isFalse();

        advance(Duration.ofSeconds(30));
        assertThat(limiter.tryAcquire()).isTrue();
        assertThat(limiter.tryAcquire()).isFalse();
    }

    @Test
    void cacheRemembersCodesUntilTheyExpire() {
        ExpiringCodeCache cache = new ExpiringCodeCache(Duration.ofHours(24), 10, now::get);
        cache.add("5900820000318");

        assertThat(cache.contains("5900820000318")).isTrue();
        assertThat(cache.contains("5901234123457")).isFalse();
        advance(Duration.ofHours(24));
        assertThat(cache.contains("5900820000318")).isFalse();
    }

    @Test
    void cacheDropsTheOldestCodeWhenFull() {
        ExpiringCodeCache cache = new ExpiringCodeCache(Duration.ofHours(24), 2, now::get);
        cache.add("1");
        cache.add("2");
        cache.add("1");
        cache.add("3");

        assertThat(cache.contains("1")).isTrue();
        assertThat(cache.contains("2")).isFalse();
        assertThat(cache.contains("3")).isTrue();
    }
}
