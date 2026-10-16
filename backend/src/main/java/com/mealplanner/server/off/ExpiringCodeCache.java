package com.mealplanner.server.off;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

public class ExpiringCodeCache {

    private final Duration ttl;
    private final int maxSize;
    private final Supplier<Instant> clock;
    private final Map<String, Instant> expiresAt = new LinkedHashMap<>();

    public ExpiringCodeCache(Duration ttl, int maxSize, Supplier<Instant> clock) {
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.clock = clock;
    }

    public synchronized void add(String code) {
        expiresAt.remove(code);
        if (expiresAt.size() >= maxSize) {
            expiresAt.remove(expiresAt.keySet().iterator().next());
        }
        expiresAt.put(code, clock.get().plus(ttl));
    }

    public synchronized boolean contains(String code) {
        Instant expiry = expiresAt.get(code);
        if (expiry == null) {
            return false;
        }
        if (!clock.get().isBefore(expiry)) {
            expiresAt.remove(code);
            return false;
        }
        return true;
    }
}
