package service

import (
	"errors"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	repo *repository.UserRepository
	cfg  *config.Config
}

type AuthTokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

func NewAuthService(repo *repository.UserRepository, cfg *config.Config) *AuthService {
	return &AuthService{repo: repo, cfg: cfg}
}

func (s *AuthService) Register(fullName, email, phone, password string, role models.Role) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if role == "" {
		role = models.RoleCustomer
	}
	user := &models.User{
		FullName:     fullName,
		Email:        email,
		Phone:        phone,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := s.repo.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) CreateStaff(fullName, email, phone, password string, role models.Role) (*models.User, error) {
	if role != models.RoleStaff && role != models.RoleAdmin {
		role = models.RoleStaff
	}
	return s.Register(fullName, email, phone, password, role)
}

func (s *AuthService) ListStaff() ([]models.User, error) {
	return s.repo.ListStaff()
}

func (s *AuthService) UpdateStaff(id uint, fullName, email, phone string, role models.Role, password string) (*models.User, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	user.FullName = fullName
	user.Email = email
	user.Phone = phone
	if role == models.RoleStaff || role == models.RoleAdmin {
		user.Role = role
	}
	// Update password if provided
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		user.PasswordHash = string(hash)
	}
	if err := s.repo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) DeleteStaff(id uint) error {
	return s.repo.Delete(id)
}

func (s *AuthService) Login(email, password string) (*models.User, *AuthTokenPair, error) {
	user, err := s.repo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, errors.New("invalid credentials")
		}
		return nil, nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, errors.New("invalid credentials")
	}
	tokens, err := s.GenerateTokens(*user)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *AuthService) GenerateTokens(user models.User) (*AuthTokenPair, error) {
	now := time.Now()
	accessExp := now.Add(time.Duration(s.cfg.JWTAccessExpireMin) * time.Minute)
	refreshExp := now.Add(time.Duration(s.cfg.JWTRefreshExpireHrs) * time.Hour)

	access := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"exp":  accessExp.Unix(),
	})
	accessToken, err := access.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	refresh := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"type": "refresh",
		"exp":  refreshExp.Unix(),
	})
	refreshToken, err := refresh.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	return &AuthTokenPair{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: s.cfg.JWTAccessExpireMin * 60}, nil
}

func (s *AuthService) Refresh(refreshToken string) (*models.User, *AuthTokenPair, error) {
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (any, error) {
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, nil, errors.New("invalid refresh token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, nil, errors.New("invalid claims")
	}
	if claims["type"] != "refresh" {
		return nil, nil, errors.New("invalid token type")
	}
	uid, ok := claims["sub"].(float64)
	if !ok {
		return nil, nil, errors.New("invalid subject")
	}
	user, err := s.repo.FindByID(uint(uid))
	if err != nil {
		return nil, nil, err
	}
	tokens, err := s.GenerateTokens(*user)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}
