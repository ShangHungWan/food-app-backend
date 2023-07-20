# Food Application

## Environment

```shell
cp docker-compose-dev.yml.example docker-compose-dev.yml
cp docker-compose-prod.yml.example docker-compose-prod.yml
```

## Development

### Start

```shell
docker-compose -f docker-compose-dev.yml up -d
```

### Down

```shell
docker-compose -f docker-compose-dev.yml down
```

## Production

### Start

```shell
docker-compose -f docker-compose-prod.yml up -d
```

### Down

```shell
docker-compose -f docker-compose-prod.yml down
```
