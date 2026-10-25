// Command api is the BlushCam HTTP API.
//
//	api                      run the server
//	api migrate              apply SQL migrations and exit
//	api seed-templates FILE  upsert templates from a JSON file (see scripts/export-templates.mts)
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/blushcam/backend/internal/config"
	"github.com/blushcam/backend/internal/handlers"
	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/imageclient"
	"github.com/blushcam/backend/internal/mail"
	"github.com/blushcam/backend/internal/storage"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/migrations"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	st, err := store.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate":
			applied, err := st.Migrate(ctx, migrations.FS)
			slog.Info("migrations applied", "versions", applied)
			return err
		case "seed-templates":
			return seedTemplates(ctx, st, os.Args[2:])
		default:
			return errors.New("unknown command " + os.Args[1])
		}
	}
	if os.Getenv("API_AUTO_MIGRATE") != "false" { // default on so `docker compose up` just works
		if _, err := st.Migrate(ctx, migrations.FS); err != nil {
			return err
		}
	}

	signer := storage.NewSigner(cfg.SigningSecret)
	var obj storage.Store
	if cfg.StorageProvider == "s3" {
		obj, err = storage.NewS3(cfg.S3.Endpoint, cfg.S3.Region, cfg.S3.Bucket, cfg.S3.AccessKey, cfg.S3.SecretKey)
	} else {
		obj, err = storage.NewLocal(cfg.LocalStorageDir, signer)
	}
	if err != nil {
		return err
	}
	d := &handlers.Deps{Cfg: cfg, Store: st, Storage: obj, Signer: signer, Mailer: mail.New(cfg.SMTP), Images: imageclient.New(cfg.ImageServiceURL, cfg.ImageServiceTimeout), AIRate: httpx.NewRateLimiter(20, time.Minute)}

	srv := &http.Server{Addr: cfg.Addr, Handler: handlers.Router(d), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 60 * time.Second, WriteTimeout: 90 * time.Second, IdleTimeout: 120 * time.Second}
	go janitor(ctx, d)
	errc := make(chan error, 1)
	go func() { slog.Info("api listening", "addr", cfg.Addr, "env", cfg.Env); errc <- srv.ListenAndServe() }()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	sctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	return srv.Shutdown(sctx)
}

// janitor enforces the retention policy: expired sessions/reset tokens and abandoned (unreferenced, >24h) uploads are purged hourly.
func janitor(ctx context.Context, d *handlers.Deps) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := d.Store.Cleanup(ctx); err != nil {
				slog.Error("cleanup failed", "err", err)
			}
			orphans, err := d.Store.OrphanAssets(ctx, d.Cfg.TempUploadMaxAge)
			if err != nil {
				slog.Error("orphan scan failed", "err", err)
				continue
			}
			for _, a := range orphans {
				if err := d.Storage.Delete(ctx, a.StorageKey); err == nil {
					_ = d.Store.DeleteAssetByID(ctx, a.ID)
				}
			}
		}
	}
}

func seedTemplates(ctx context.Context, st *store.Store, args []string) error {
	if len(args) != 1 {
		return errors.New("usage: api seed-templates templates.json")
	}
	b, err := os.ReadFile(args[0])
	if err != nil {
		return err
	}
	var list []store.Template
	if err := json.Unmarshal(b, &list); err != nil {
		return err
	}
	for i, t := range list {
		if err := st.UpsertTemplate(ctx, t, i); err != nil {
			return err
		}
	}
	slog.Info("templates seeded", "count", len(list))
	return nil
}
