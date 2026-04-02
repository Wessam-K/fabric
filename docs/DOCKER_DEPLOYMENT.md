# Docker Deployment Guide — WK-Factory

## Prerequisites

- Docker 24+ & Docker Compose v2
- TLS certificate and key (for HTTPS)
- 64+ character JWT secret

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Wessam-K/fabric.git && cd fabric

# 2. Create .env from template
cp .env.example .env
# Edit .env — set JWT_SECRET and SMTP_* at minimum

# 3. Place TLS certs
mkdir -p certs
cp /path/to/your/cert.pem certs/server.crt
cp /path/to/your/key.pem  certs/server.key

# 4. Build and start
docker compose up -d --build

# 5. Verify
docker compose ps
curl -k https://localhost/api/health
curl -k https://localhost/api/readiness
```

## Architecture

```
                    ┌─────────────┐
  Browser ──443──▶  │   nginx     │
                    │  (TLS term) │
                    └──────┬──────┘
                           │ :9002 (HTTP)
                    ┌──────▼──────┐
                    │ wk-factory  │
                    │ Node.js 22  │
                    │ Express+SQLite│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  wk-data    │
                    │  (volume)   │
                    └─────────────┘
```

## Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `wk-factory` | Custom (Node 22 Alpine) | 9002 (internal) | Backend API + static frontend |
| `nginx` | nginx:alpine | 80, 443 | TLS termination, reverse proxy |

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `wk-data` | `/data` | SQLite database, uploads, backups, logs |
| `./certs` | `/etc/nginx/certs` | TLS certificate and key (read-only) |

## Environment Variables

Set these in `.env` (see [.env.example](../.env.example) for the full list):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | auto-generated | Min 64 chars; also derives webhook encryption |
| `NODE_ENV` | No | `production` | Environment mode |
| `PORT` | No | `9002` | Internal API port |
| `CORS_ORIGIN` | No | `https://localhost` | Allowed origins |
| `SMTP_HOST` | For email | — | SMTP server for password reset emails |
| `SMTP_PORT` | For email | — | SMTP port (587 for STARTTLS, 465 for SSL) |
| `SMTP_USER` | For email | — | SMTP username |
| `SMTP_PASS` | For email | — | SMTP password |
| `SMTP_FROM` | For email | — | Sender address |
| `APP_BASE_URL` | For email | — | URL in password reset links |
| `LICENSE_HMAC_SECRET` | For licensing | — | HMAC-SHA256 license key |
| `AUTO_BACKUP_HOURS` | No | `6` | Backup interval |
| `SENTRY_DSN` | No | — | Sentry error tracking |
| `LOG_LEVEL` | No | `info` | Winston log level |

## Operations

### View logs
```bash
docker compose logs -f wk-factory
docker compose logs -f nginx
```

### Restart
```bash
docker compose restart wk-factory
```

### Backup database
```bash
# Copy from the volume
docker cp wk-factory:/data/wk-hub.db ./backup-$(date +%Y%m%d).db
```

### Restore database
```bash
docker compose stop wk-factory
docker cp ./backup.db wk-factory:/data/wk-hub.db
docker compose start wk-factory
```

### Update
```bash
git pull
docker compose up -d --build
```

### Health checks
```bash
# Liveness
curl -k https://localhost/api/health

# Readiness (checks DB + tables)
curl -k https://localhost/api/readiness
```

## TLS Certificate

The nginx service expects:
- `certs/server.crt` — TLS certificate (or fullchain)
- `certs/server.key` — Private key

For Let's Encrypt, use certbot and symlink:
```bash
ln -s /etc/letsencrypt/live/yourdomain/fullchain.pem certs/server.crt
ln -s /etc/letsencrypt/live/yourdomain/privkey.pem certs/server.key
docker compose restart nginx
```

## Data Persistence

All persistent data lives in the `wk-data` Docker volume mounted at `/data`:
- `wk-hub.db` — SQLite database
- `uploads/` — Uploaded files (receipts, documents)
- `backups/` — Automated backups (every `AUTO_BACKUP_HOURS` hours)
- `logs/` — Winston log files (daily rotation)
