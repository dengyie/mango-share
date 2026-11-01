package main

import (
	"bytes"
	"context"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"log"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestSecuritySendCodeEnumeration(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	if _, err := st.createUser("taken@example.com", "hash", ""); err != nil {
		t.Fatal(err)
	}
	srv := NewServer(LoadConfig(), st, failMailer{}, log.New(io.Discard, "", 0))
	defer srv.Close(context.Background())
	request := func(email string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/api/auth/send-code", bytes.NewBufferString(`{"email":"`+email+`","purpose":"register"}`))
		r.RemoteAddr = "192.0.2.1:1234"
		w := httptest.NewRecorder()
		srv.Handler().ServeHTTP(w, r)
		return w
	}
	a, b := request("taken@example.com"), request("free@example.com")
	if a.Code != b.Code || a.Body.String() != b.Body.String() {
		t.Errorf("suppressed vs mail failure: %d %s vs %d %s", a.Code, a.Body.String(), b.Code, b.Body.String())
	}
	if err := st.saveCode("free@example.com", purposeRegister, sha256Hex("123456"), time.Minute, 0); err != nil {
		t.Fatal(err)
	}
	c := request("free@example.com")
	if a.Code != c.Code || a.Body.String() != c.Body.String() || c.Header().Get("Retry-After") != "" {
		t.Errorf("suppressed vs cooldown: %d %s vs %d %s", a.Code, a.Body.String(), c.Code, c.Body.String())
	}
}

func TestSecurityConcurrentCodeConsumption(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	for round := 0; round < 20; round++ {
		if err := st.saveCode("race@example.com", purposeReset, sha256Hex("123456"), time.Minute, 0); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		results := make(chan error, 32)
		start := make(chan struct{})
		for i := 0; i < 32; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); <-start; results <- st.verifyCode("race@example.com", purposeReset, "123456") }()
		}
		close(start)
		wg.Wait()
		close(results)
		successes := 0
		for err := range results {
			if err == nil {
				successes++
			}
		}
		if successes != 1 {
			t.Fatalf("round %d: %d consumers succeeded", round, successes)
		}
	}
}

func TestSecurityUntrustedProxyHeaders(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "203.0.113.4:1234"
	r.Header.Set("X-Real-IP", "198.51.100.1")
	r.Header.Set("X-Forwarded-For", "198.51.100.2")
	if got := clientIP(r); got != "203.0.113.4" {
		t.Fatalf("untrusted peer header accepted: %q", got)
	}
	r.RemoteAddr = "127.0.0.1:1234"
	if got := clientIP(r); got != "198.51.100.1" {
		t.Fatalf("loopback proxy header ignored: %q", got)
	}
	r.Header.Set("X-Real-IP", "invalid, 198.51.100.1")
	if got := clientIP(r); got != "127.0.0.1" {
		t.Fatalf("malformed proxy header accepted: %q", got)
	}
}

func TestSecurityHTTPBodyAndWriteTimeouts(t *testing.T) {
	f, err := parser.ParseFile(token.NewFileSet(), "main.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	ast.Inspect(f, func(n ast.Node) bool {
		c, ok := n.(*ast.CompositeLit)
		if !ok {
			return true
		}
		s, ok := c.Type.(*ast.SelectorExpr)
		if !ok || s.Sel.Name != "Server" {
			return true
		}
		for _, e := range c.Elts {
			if kv, ok := e.(*ast.KeyValueExpr); ok {
				if k, ok := kv.Key.(*ast.Ident); ok && (k.Name == "ReadTimeout" || k.Name == "WriteTimeout") {
					found[k.Name] = true
				}
			}
		}
		return true
	})
	if !found["ReadTimeout"] || !found["WriteTimeout"] {
		t.Fatalf("server timeout fields missing: %v", found)
	}
}
