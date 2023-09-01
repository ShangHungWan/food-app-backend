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
cp docker-compose-dev.yml.example docker-compose.yml
# or Prod
cp Dockerfile.prod Dockerfile
cp docker-compose-prod.yml.example docker-compose.yml
```

## Execution

### Start

```shell
docker-compose up -d # dev
docker-compose up -d # prod
```

### Down

```shell
docker-compose down # dev
docker-compose down # prod
```

## Setup for first time

```shell
docker-compose exec web npm run migrate up
docker-compose exec postgres -U foodappuser -d food_app -a -f /sqls/create_regions.sql
```
