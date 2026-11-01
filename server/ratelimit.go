package main

import (
	"sync"
	"time"
)

// rateLimiter is an in-memory fixed-window counter, keyed freely
// ("sc:ip:1.2.3.4", "login:acct:a@b.c", ...). Sufficient for a
// single-instance service of this scale.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*rlBucket
}

// maxRLBuckets bounds the key space: keys are attacker-controlled
// (client IPs, emails), so once the map grows past this many entries the
// next allow() sweeps expired buckets and rejects new keys if still full.
const maxRLBuckets = 10_000

type rlBucket struct {
	count  int
	window time.Time
	period time.Duration
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{buckets: make(map[string]*rlBucket)}
}

func (rl *rateLimiter) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if len(rl.buckets) >= maxRLBuckets {
		rl.sweepLocked(now)
	}
	b, ok := rl.buckets[key]
	if !ok || now.Sub(b.window) >= window {
		if !ok && len(rl.buckets) >= maxRLBuckets {
			return false
		}
		rl.buckets[key] = &rlBucket{count: 1, window: now, period: window}
		return true
	}
	if b.count >= limit {
		return false
	}
	b.count++
	return true
}

// sweepLocked drops buckets whose fixed window has passed. Deleting during
// range is safe in Go.
func (rl *rateLimiter) sweepLocked(now time.Time) {
	for k, b := range rl.buckets {
		if now.Sub(b.window) >= b.period {
			delete(rl.buckets, k)
		}
	}
}

// reset clears failure counters (e.g. after a successful login).
func (rl *rateLimiter) reset(prefix string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for k := range rl.buckets {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(rl.buckets, k)
		}
	}
}
