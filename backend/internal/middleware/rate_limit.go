package middleware

import (
	"net/http"
	"sync"
	"time"

	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type rateWindow struct {
	count int
	reset time.Time
}

type IPRateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	clients map[string]rateWindow
}

func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	if limit <= 0 {
		limit = 10
	}
	if window <= 0 {
		window = time.Minute
	}
	return &IPRateLimiter{limit: limit, window: window, clients: make(map[string]rateWindow)}
}

func (l *IPRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		now := time.Now()
		key := c.ClientIP()
		l.mu.Lock()
		entry := l.clients[key]
		if entry.reset.IsZero() || !now.Before(entry.reset) {
			entry = rateWindow{reset: now.Add(l.window)}
		}
		entry.count++
		l.clients[key] = entry
		allowed := entry.count <= l.limit
		if len(l.clients) > 5000 {
			l.cleanup(now)
		}
		l.mu.Unlock()
		if !allowed {
			response.Error(c, http.StatusTooManyRequests, "RATE_LIMITED", "too many requests; try again later")
			c.Abort()
			return
		}
		c.Next()
	}
}

func (l *IPRateLimiter) cleanup(now time.Time) {
	for key, entry := range l.clients {
		if !now.Before(entry.reset) {
			delete(l.clients, key)
		}
	}
}

func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}
