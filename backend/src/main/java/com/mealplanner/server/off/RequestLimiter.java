package com.mealplanner.server.off;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.Supplier;

public class RequestLimiter {

    private final int maxRequests;
    private final Duration window;
    private final Supplier<Instant> clock;
    private final Deque<Instant> recent = new ArrayDeque<>();

    public RequestLimiter(int maxRequests, Duration window, Supplier<Instant> clock) {
        this.maxRequests = maxRequests;
        this.window = window;
        this.clock = clock;
    }

    public synchronized boolean tryAcquire() {
        Instant now = clock.get();
        Instant windowStart = now.minus(window);
        while (!recent.isEmpty() && !recent.peekFirst().isAfter(windowStart)) {
            recent.pollFirst();
        }
        if (recent.size() >= maxRequests) {
            return false;
        }
        recent.addLast(now);
        return true;
    }
}
