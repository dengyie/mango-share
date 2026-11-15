package main

import (
	"sync"
	"time"
)

// rateLimiter is an in-memory fixed-window counter, keyed freely
// ("sc:ip:1.2.3.4", "login:acct:a@b.c", ...). Sufficient for a
// single-instance service of this scale.
//
// Keys that count *failures* (not admissions) must only be incremented via
// allowFail: admission counters would lock out shared-NAT IPs for normal
// successful traffic.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*rlBucket
}

// maxRLBuckets bounds the key space: keys are attacker-controlled
// (client IPs, emails). Once full, allow() sweeps expired buckets and, if
// still full, evicts the oldest bucket — rejecting brand-new keys would
// let one attacker holding maxRLBuckets alive keys 429 every new user.
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
			rl.evictOldestLocked()
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

// burn records one failure against key without any limit check: failure
// counters are consumed after the fact (noteLoginFail), and blocking is
// decided separately by rlExceeded. A brand-new key starts at count=1.
func (rl *rateLimiter) burn(key string, window time.Duration) {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if len(rl.buckets) >= maxRLBuckets {
		rl.sweepLocked(now)
	}
	b, ok := rl.buckets[key]
	if !ok || now.Sub(b.window) >= window {
		if !ok && len(rl.buckets) >= maxRLBuckets {
			rl.evictOldestLocked()
		}
		rl.buckets[key] = &rlBucket{count: 1, window: now, period: window}
		return
	}
	b.count++
}

// evictOldestLocked drops the bucket with the oldest window start. Called
// only when the map is at capacity after a sweep; on ties (same window
// start) any victim is fine.
func (rl *rateLimiter) evictOldestLocked() {
	var oldestKey string
	var oldest time.Time
	first := true
	for k, b := range rl.buckets {
		if first || b.window.Before(oldest) {
			oldestKey, oldest, first = k, b.window, false
		}
	}
	if !first {
		delete(rl.buckets, oldestKey)
	}
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

// rlExceeded reports whether a failure-counter key has already hit its
// limit, WITHOUT consuming an attempt — consumption happens in
// noteLoginFail only once a failure is confirmed.
func rlExceeded(s *Server, key string, limit int) bool {
	s.rl.mu.Lock()
	defer s.rl.mu.Unlock()
	b, ok := s.rl.buckets[key]
	if !ok {
		return false
	}
	if time.Now().Sub(b.window) >= b.period {
		return false
	}
	return b.count >= limit
}

// noteLoginFail burns one attempt on each failure key after a failed login.
// A brand-new key starts at count=1 (the failure itself); each further
// failure increments. The burn reuse of allow() is safe: an over-limit key
// returns false and is a no-op since the block is enforced by rlExceeded.
func (s *Server) noteLoginFail(keys ...string) {
	for _, k := range keys {
		s.rl.burn(k, loginIPWindow)
	}
}
