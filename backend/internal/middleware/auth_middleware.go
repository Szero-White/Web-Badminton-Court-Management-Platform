package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	ContextUserIDKey = "userID"
	ContextRoleKey   = "role"
)

func AuthRequired(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing or invalid Authorization header")
			c.Abort()
			return
		}
		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (any, error) { return []byte(jwtSecret), nil }, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
		if err != nil || !token.Valid {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token")
			c.Abort()
			return
		}
		if tokenType, _ := claims["type"].(string); tokenType != "access" {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token type")
			c.Abort()
			return
		}
		subject, err := claims.GetSubject()
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token subject")
			c.Abort()
			return
		}
		uid, err := strconv.ParseUint(subject, 10, 64)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token subject")
			c.Abort()
			return
		}
		role, ok := claims["role"].(string)
		if !ok || role == "" {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing role claim")
			c.Abort()
			return
		}
		c.Set(ContextUserIDKey, uint(uid))
		c.Set(ContextRoleKey, role)
		c.Next()
	}
}

func RequireRoles(roles ...models.Role) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[string(role)] = struct{}{}
	}
	return func(c *gin.Context) {
		roleValue, ok := c.Get(ContextRoleKey)
		if !ok {
			response.Error(c, http.StatusForbidden, "FORBIDDEN", "missing role")
			c.Abort()
			return
		}
		role, _ := roleValue.(string)
		if _, ok := allowed[role]; !ok {
			response.Error(c, http.StatusForbidden, "FORBIDDEN", "access denied")
			c.Abort()
			return
		}
		c.Next()
	}
}
