# Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose v2+
- At least 512MB RAM available

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Wessam-K/fabric.git
cd fabric

# Build and start
docker compose up -d

# The app will be available at http://localhost:9002
```

## Architecture

The Docker setup uses a multi-stage build:

1. **Frontend build stage** — Builds the React frontend with Vite
2. **Production stage** — Runs the Node.js backend serving both API and static frontend

```
┌──────────────────────────────┐
│  Docker Container            │
│  ┌────────────────────────┐  │
│  │  Node.js 22 (Alpine)   │  │
│  │  Express Server :9002  │  │
│  │  ┌──────────────────┐  │  │
│  │  │  SQLite DB       │──┼──┼── Volume: ./data
│  │  └──────────────────┘  │  │
│  │  ┌──────────────────┐  │  │
│  │  │  Uploads         │──┼──┼── Volume: ./uploads  
│  │  └──────────────────┘  │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9002` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | (auto-generated) | JWT signing secret |
| `BACKUP_INTERVAL_HOURS` | `24` | Auto-backup interval |

### Volumes

| Path | Purpose |
|------|---------|
| `./data:/app/backend/data` | SQLite database persistence |
| `./uploads:/app/backend/uploads` | Uploaded files |
| `./backups:/app/backend/backups` | Database backups |

## docker-compose.yml

```yaml
services:
  wk-factory:
    build: .
    ports:
      - "9002:9002"
    volumes:
      - ./data:/app/backend/data
      - ./uploads:/app/backend/uploads
      - ./backups:/app/backend/backups
    environment:
      - NODE_ENV=production
      - JWT_SECRET=change-me-to-a-secure-random-string
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:9002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Building

```bash
# Build the image
docker build -t wk-factory .

# Run manually
docker run -d \
  -p 9002:9002 \
  -v $(pwd)/data:/app/backend/data \
  -v $(pwd)/uploads:/app/backend/uploads \
  --name wk-factory \
  wk-factory
```

## Backup & Restore

### Create a backup
```bash
# Using the API
curl -X POST http://localhost:9002/api/backups \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or copy the DB file directly
docker cp wk-factory:/app/backend/data/wk-hub.db ./wk-hub-backup.db
```

### Restore from backup
```bash
docker compose down
cp ./wk-hub-backup.db ./data/wk-hub.db
docker compose up -d
```

## Updating

```bash
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## Troubleshooting

### Container won't start
```bash
docker compose logs wk-factory
```

### Database locked error
Ensure only one container instance is running:
```bash
docker compose ps
```

### Permission issues on volumes
```bash
chmod -R 777 ./data ./uploads ./backups
```

### Health check failing
```bash
docker compose exec wk-factory wget -q --spider http://localhost:9002/api/health
```
