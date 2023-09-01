# Food Application Backend

## Environment

1. Generate `.env`

```shell
cp .env.example .env
```

2. Generate the secrete and paste it to `.env`

```shell
python ./scripts/generate_secret.py
```

3. Generate docker files

```shell
# Dev
cp Dockerfile.dev Dockerfile
cp docker-compose-dev.yml.example docker-compose-dev.yml
# Prod
cp Dockerfile.prod Dockerfile
cp docker-compose-prod.yml.example docker-compose-prod.yml
```

## Execution

### Start

```shell
docker-compose -f docker-compose-dev.yml up -d # dev
docker-compose -f docker-compose-prod.yml up -d # prod
```

### Down

```shell
docker-compose -f docker-compose-dev.yml down # dev
docker-compose -f docker-compose-prod.yml down # prod
```

## Setup for first time

```shell
docker exec food-app-backend-prod-web-1 npm run migrate up
docker exec food-app-backend-prod-postgres-1 psql -U foodappuser -d food_app -a -f /sqls/create_regions.sql
```
