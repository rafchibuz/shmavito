# Production deployment on the shared VPS

This setup is isolated from the existing Ravshan services. The new Compose project is
named `shmavito`; its PostgreSQL is reachable only on its private Docker network.
Only the app is published, on `127.0.0.1:8090`. The host Nginx serves
`shmavito.ravshan.tv` on the existing public ports 80/443.

The VPS currently has 1.9 GiB RAM and no swap. Create at least 2 GiB swap before
building the image, or build the image off-server. Do not run `docker system prune`
or change the existing Compose projects.

## Before starting

1. Set a DNS-only A record `shmavito.ravshan.tv -> 31.76.230.149`.
2. Take a VPS snapshot if the provider offers one.
3. Rotate the Twitch application secret used in local development. In Twitch
   Developer Console add the exact redirect URI
   `https://shmavito.ravshan.tv/api/auth/callback/twitch`.
4. Clone this repository to `/opt/shmavito` and create `/opt/shmavito/.env.production`
   from `.env.production.example`. Restrict it with `chmod 600`. Generate three
   separate 32-byte random hex strings with `openssl rand -hex 32` for
   `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `CRON_SECRET`. Enter the Twitch client
   ID and the newly rotated secret only on the server.

## Start in a safe order

Run from `/opt/shmavito` after the environment file is ready:

```sh
docker compose --env-file .env.production -f deploy/compose.prod.yml config --quiet
docker compose --env-file .env.production -f deploy/compose.prod.yml build app
docker compose --env-file .env.production -f deploy/compose.prod.yml up -d postgres
docker compose --env-file .env.production -f deploy/compose.prod.yml --profile setup run --rm migrate
docker compose --env-file .env.production -f deploy/compose.prod.yml --profile setup run --rm seed
docker compose --env-file .env.production -f deploy/compose.prod.yml up -d app backup availability-cron
curl --fail http://127.0.0.1:8090/api/categories
```

Run `docker compose --env-file .env.production -f deploy/compose.prod.yml ps`
to confirm healthy containers. The backup service writes an initial checked dump
to `/opt/shmavito/backups/daily` and repeats every 24 hours. Copy these backups
off the VPS regularly; a copy on the same disk cannot survive disk loss.

## HTTPS without changing the other Nginx sites

First copy `deploy/nginx-http.conf` to `/etc/nginx/sites-available/shmavito`,
symlink it in `sites-enabled`, test with `nginx -t`, then reload Nginx. Obtain a
certificate for only this hostname with Certbot's webroot mode; the challenge
directory is `/var/www/letsencrypt`. Once the certificate exists, replace just
this site's config with `deploy/nginx-https.conf`, test, and reload. Do not edit
the `ravshan` or `twitch-panel` files.

The HTTPS proxy overwrites client forwarding headers before setting
`TRUST_PROXY_HEADERS=true` in the app. Keep the app port bound to loopback.

## Checks and update

Check the public page, `/api/categories`, Twitch login, submission and moderation,
then test from a Russian mobile connection without VPN. A DNS lookup alone does
not prove nationwide reachability.

Before updates, confirm a backup exists. Pull the desired commit, build the app
image, run migrations, and recreate only the `shmavito` app. Never use
`docker compose down -v` or `docker system prune --volumes` on this VPS.
