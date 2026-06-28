package middleware

import (
	"errors"
	"net/http"
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
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing Authorization header")
			c.Abort()
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid Authorization format")
			c.Abort()
			return
		}

		token, err := jwt.Parse(parts[1], func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token")
			c.Abort()
			return
		}
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token claims")
			c.Abort()
			return
		}

		uidFloat, ok := claims["sub"].(float64)
		if !ok {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid token subject")
			c.Abort()
			return
		}

		role, ok := claims["role"].(string)
		if !ok || role == "" {
			role = string(models.RoleCustomer)
		}

		c.Set(ContextUserIDKey, uint(uidFloat))
		c.Set(ContextRoleKey, role)
		c.Next()
	}
}

func RequireRoles(roles ...models.Role) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, r := range roles {
		allowed[string(r)] = true
	}
	return func(c *gin.Context) {
		roleVal, ok := c.Get(ContextRoleKey)
		if !ok {
			response.Error(c, http.StatusForbidden, "FORBIDDEN", "missing role")
			c.Abort()
			return
		}
		role, _ := roleVal.(string)
		if !allowed[role] {
			response.Error(c, http.StatusForbidden, "FORBIDDEN", "access denied")
			c.Abort()
			return
		}
		c.Next()
	}
}
