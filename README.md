# FreightDesk API

External API for the FreightDesk desktop app. Supabase keys stay on this server.

## Requirements

- Node.js 18+ (Node 20 on Linux needs the bundled `ws` package — included in dependencies)

```bash
git clone https://github.com/web-source-dev/freightdesk-b.git
cd freightdesk-b

# 1. Install dependencies FIRST (required before starting)
npm install

# 2. Create .env from the example and fill in all values
cp .env.example .env
nano .env

# Verify config before starting
npm run check-env

# 3. Test locally
npm start

# 4. Start with PM2 (from this directory)
pm2 delete freightdesk-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
```

### Required `.env` variables

| Variable | Description |
|----------|-------------|
| `API_PORT` | Port to listen on (default `3850`) |
| `API_JWT_SECRET` | Strong random secret for JWT signing |
| `USER_SUPABASE_URL` | Supabase project for login users |
| `USER_SUPABASE_SERVICE_KEY` | Service role key for user DB |
| `SESSION_SUPABASE_URL` | Supabase project for DAT sessions/proxies |
| `SESSION_SUPABASE_SERVICE_KEY` | Service role key for session DB |

Optional: `FREIGHTDESK_API_URL` (public URL, e.g. `https://api.yourdomain.com:3850`).

### Health check

```bash
curl http://localhost:3850/api/health
```

### Common mistakes

- **Starting PM2 before `npm install`** → `Cannot find module 'express'`. Fix: run `npm install`, then `pm2 delete freightdesk-api && pm2 start ecosystem.config.js`.
- **Using `--watch` in production** → crash loops during install/restarts. Use `ecosystem.config.js` with `watch: false`.
- **Port via CLI** (`pm2 start server.js -- 3850`) → ignored. Set `API_PORT=3850` in `.env` instead.
- **Missing `.env`** → process exits immediately. Run `cp .env.example .env`, fill values, then `npm run check-env`.
- **Empty PM2 logs** → usually means no `.env` yet. Run `npm start` in the terminal first to see the error message.

### Seed admin user

```bash
npm run seed:admin
```
