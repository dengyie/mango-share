// Command account-server is the standalone user-account backend for
// mangoshare: open email-code registration, password login and per-user
// item checklists (opened / wanted). It binds loopback only — nginx
// terminates TLS and proxies /account-api/ to it.
package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	cfg := LoadConfig()
	logger := log.New(os.Stdout, "account-server ", log.LstdFlags|log.LUTC)

	st, err := openStore(cfg.DBPath)
	if err != nil {
		logger.Fatalf("open store %s: %v", cfg.DBPath, err)
	}
	defer st.close()

	var mailer Mailer
	switch {
	case cfg.OneMailAPI != "" && cfg.OneMailToken != "":
		// Preferred: send through the one-mail Worker (per-domain Resend
		// dispatch, sendbox audit trail). The From address comes from the
		// address JWT, so MailFrom only carries the display name here.
		fromName := cfg.MailFrom
		if i := strings.LastIndex(fromName, "<"); i > 0 {
			fromName = strings.TrimSpace(fromName[:i])
		}
		fromName = strings.Trim(fromName, `"`)
		mailer = newOneMailMailer(cfg.OneMailAPI, cfg.OneMailToken, fromName)
	case cfg.ResendAPIKey != "":
		mailer = newResendMailer(cfg.ResendAPIKey, cfg.MailFrom)
	default:
		logger.Print("WARNING: neither ONE_MAIL_* nor RESEND_API_KEY set — verification codes go to the log only (dev mode)")
		mailer = devMailer{logger: logger}
	}

	// Confirm the env parse took effect: this list is what accounts are
	// matched against for the admin role, so a mangled ADMIN_EMAIL would
	// otherwise silently demote everyone to plain user.
	if len(cfg.AdminEmails) == 0 {
		logger.Print("admin_emails: none — no account holds the admin role")
	} else {
		logger.Printf("admin_emails: %s", strings.Join(cfg.AdminEmails, ", "))
	}

	srv := NewServer(cfg, st, mailer, logger)

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	ln, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		logger.Fatalf("listen %s: %v", cfg.Addr, err)
	}

	done := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(ctx)
		if err := srv.Close(ctx); err != nil {
			logger.Printf("send-code shutdown: %v", err)
		}
		close(done)
	}()

	logger.Printf("listening on %s (db=%s mailer=%T)", cfg.Addr, cfg.DBPath, mailer)
	if err := httpSrv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Fatalf("serve: %v", err)
	}
	<-done
	logger.Print("stopped")
}
