package service

import (
	"errors"
	"fmt"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const minPasswordLength = 8

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
	fullName = strings.TrimSpace(fullName)
	email = strings.ToLower(strings.TrimSpace(email))
	phone = normalizePhone(phone)
	if err := validateAccountInput(fullName, email, phone, password); err != nil {
		return nil, err
	}
	if role == "" {
		role = models.RoleCustomer
	}
	if role != models.RoleCustomer && role != models.RoleStaff && role != models.RoleAdmin {
		return nil, fmt.Errorf("invalid role")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &models.User{FullName: fullName, Email: email, Phone: phone, PasswordHash: string(hash), Role: role}
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

func (s *AuthService) ListStaff() ([]models.User, error) { return s.repo.ListStaff() }

func (s *AuthService) UpdateStaff(actorID, id uint, fullName, email, phone string, role models.Role, password string) (*models.User, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	fullName, email, phone = strings.TrimSpace(fullName), strings.ToLower(strings.TrimSpace(email)), normalizePhone(phone)
	if fullName == "" || email == "" || phone == "" {
		return nil, fmt.Errorf("full_name, email and phone are required")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, fmt.Errorf("invalid email")
	}
	user.FullName, user.Email, user.Phone = fullName, email, phone
	if role == models.RoleStaff || role == models.RoleAdmin {
		if actorID == id && role != user.Role {
			return nil, fmt.Errorf("you cannot change your own administrator role")
		}
		user.Role = role
	}
	if password != "" {
		if len(password) < minPasswordLength {
			return nil, fmt.Errorf("password must be at least %d characters", minPasswordLength)
		}
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

func (s *AuthService) DeleteStaff(actorID, id uint) error {
	if actorID == id {
		return fmt.Errorf("you cannot delete your own account")
	}
	user, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if user.Role != models.RoleStaff && user.Role != models.RoleAdmin {
		return fmt.Errorf("only staff or admin accounts can be deleted here")
	}
	if user.Role == models.RoleAdmin {
		count, err := s.repo.CountByRole(models.RoleAdmin)
		if err != nil {
			return err
		}
		if count <= 1 {
			return fmt.Errorf("the last administrator account cannot be deleted")
		}
	}
	return s.repo.Delete(id)
}

func (s *AuthService) Login(email, password string) (*models.User, *AuthTokenPair, error) {
	user, err := s.repo.FindByEmail(strings.ToLower(strings.TrimSpace(email)))
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
	common := func(tokenType string, exp time.Time) jwt.MapClaims {
		return jwt.MapClaims{"sub": strconv.FormatUint(uint64(user.ID), 10), "role": string(user.Role), "type": tokenType, "iat": now.Unix(), "exp": exp.Unix()}
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, common("access", accessExp)).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, common("refresh", refreshExp)).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}
	return &AuthTokenPair{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: s.cfg.JWTAccessExpireMin * 60}, nil
}

func (s *AuthService) Refresh(refreshToken string) (*models.User, *AuthTokenPair, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(token *jwt.Token) (any, error) { return []byte(s.cfg.JWTSecret), nil }, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, nil, errors.New("invalid refresh token")
	}
	if tokenType, _ := claims["type"].(string); tokenType != "refresh" {
		return nil, nil, errors.New("invalid token type")
	}
	subject, err := claims.GetSubject()
	if err != nil {
		return nil, nil, errors.New("invalid subject")
	}
	uid, err := strconv.ParseUint(subject, 10, 64)
	if err != nil {
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

func validateAccountInput(fullName, email, phone, password string) error {
	if fullName == "" || email == "" || phone == "" {
		return fmt.Errorf("full_name, email and phone are required")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return fmt.Errorf("invalid email")
	}
	if len(password) < minPasswordLength {
		return fmt.Errorf("password must be at least %d characters", minPasswordLength)
	}
	return nil
}

func normalizePhone(value string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", ".", "", "(", "", ")", "")
	return replacer.Replace(strings.TrimSpace(value))
}
