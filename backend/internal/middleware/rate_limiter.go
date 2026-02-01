package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	requests    map[string][]time.Time
	mu          sync.RWMutex
	maxRequests int
	window      time.Duration
}

func newRateLimiter(maxRequests int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		requests:    make(map[string][]time.Time),
		maxRequests: maxRequests,
		window:      window,
	}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Clean up old requests
	times := rl.requests[key]
	validTimes := []time.Time{}
	for _, t := range times {
		if t.After(cutoff) {
			validTimes = append(validTimes, t)
		}
	}

	// Check if under limit
	if len(validTimes) >= rl.maxRequests {
		rl.requests[key] = validTimes
		return false
	}

	// Add current request
	validTimes = append(validTimes, now)
	rl.requests[key] = validTimes
	return true
}

// RateLimitMiddleware limits requests per IP address
func RateLimitMiddleware(maxRequests int, window time.Duration) gin.HandlerFunc {
	limiter := newRateLimiter(maxRequests, window)

	return func(c *gin.Context) {
		// Use IP address as key
		key := c.ClientIP()

		if !limiter.allow(key) {
			c.JSON(429, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
