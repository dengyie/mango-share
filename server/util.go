package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"regexp"
	"strings"
	"unicode"
)

// 512KB: the merge sync uploads the full item list in one request
// (2000 items ≈ 190KB worst case).
const maxBodyBytes = 512 << 10

var emailRe = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$`)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// readJSON decodes a strictly single-object JSON body with a hard size cap.
func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return false
	}
	return true
}

// clientIP accepts only nginx's single-address X-Real-IP header from a
// loopback peer. Forwarded chains are not trusted: their leftmost entries
// can be supplied by clients even when a proxy appends its own address.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer := net.ParseIP(host)
	if peer != nil && peer.IsLoopback() {
		if ip := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); ip != nil {
			return ip.String()
		}
	}
	if peer != nil {
		return peer.String()
	}
	return host
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validEmail(s string) bool {
	return len(s) <= 254 && emailRe.MatchString(s)
}

func validPassword(s string) bool {
	return len(s) >= 8 && len(s) <= 72
}

func validCode(s string) bool {
	if len(s) != 6 {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// sanitizeDisplayName strips control characters and caps length; falls
// back to the email local part when empty.
func sanitizeDisplayName(s, email string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	s = strings.Join(strings.Fields(s), " ")
	if s == "" {
		if i := strings.Index(email, "@"); i > 0 {
			s = email[:i]
		}
	}
	if runes := []rune(s); len(runes) > 32 {
		s = string(runes[:32])
	}
	return s
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// randomToken returns a 256-bit URL-safe opaque bearer token.
func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// randomCode returns a uniformly random 6-digit numeric code.
func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
