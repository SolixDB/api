# Deployment Guide

This guide covers deploying the SolixDB API to production.

## Prerequisites

- Node.js 20+ or Docker
- ClickHouse database (accessible via HTTP)
- Redis instance
- API keys configured

## Environment Variables

Create a `.env` file with all required variables:

```env
PORT=3000
NODE_ENV=production

# ClickHouse Configuration
CLICKHOUSE_URL=http://your-clickhouse:8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password

# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TTL=3600

# API Configuration
API_KEY_HEADER=X-API-Key
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
VALID_API_KEYS=key1,key2,key3
```

## Docker Deployment

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Using Docker

```bash
# Build image
docker build -t solixdb-api .

# Run container
docker run -d \
  --name solixdb-api \
  -p 3000:3000 \
  --env-file .env \
  solixdb-api
```

## Manual Deployment

### 1. Install Dependencies

```bash
npm ci --production
```

### 2. Build

```bash
npm run build
```

### 3. Start

```bash
npm start
```

### 4. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/index.js --name solixdb-api

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Production Checklist

- [ ] Environment variables configured
- [ ] ClickHouse connection tested
- [ ] Redis connection tested
- [ ] API keys configured
- [ ] Rate limits configured
- [ ] Health check endpoint accessible
- [ ] Logging configured
- [ ] Monitoring setup
- [ ] SSL/TLS configured (if using reverse proxy)
- [ ] Firewall rules configured

## Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.solixdb.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL/TLS

Use Let's Encrypt with Certbot:

```bash
sudo certbot --nginx -d api.solixdb.com
```

## Monitoring

### Health Checks

Monitor the health endpoint:

```bash
curl http://localhost:3000/health
```

### Logs

Application logs are output to stdout/stderr. Configure log aggregation:

- **Docker**: Use `docker logs` or log drivers
- **PM2**: Use `pm2 logs`
- **Systemd**: Use `journalctl`

### Metrics

Consider adding:
- Prometheus metrics
- Application Performance Monitoring (APM)
- Error tracking (Sentry, etc.)

## Scaling

### Horizontal Scaling

Run multiple instances behind a load balancer:

```bash
# Start multiple instances
pm2 start dist/index.js -i 4 --name solixdb-api
```

### Load Balancer Configuration

- Use sticky sessions if needed
- Configure health checks
- Set up SSL termination

## Backup

- **Redis**: Configure Redis persistence (AOF/RDB)
- **ClickHouse**: Follow ClickHouse backup procedures
- **Configuration**: Backup `.env` files securely

## Security

1. **API Keys**: Store securely, rotate regularly
2. **Environment Variables**: Never commit to version control
3. **Network**: Use firewall rules to restrict access
4. **SSL/TLS**: Always use HTTPS in production
5. **Updates**: Keep dependencies updated

## Troubleshooting

### Service Won't Start

1. Check environment variables
2. Verify ClickHouse connection
3. Verify Redis connection
4. Check port availability
5. Review logs

### High Latency

1. Check ClickHouse query performance
2. Verify Redis is working
3. Check network latency
4. Review query patterns
5. Consider increasing cache TTL

### Rate Limit Issues

1. Verify rate limit configuration
2. Check Redis connection
3. Review API key usage
4. Consider increasing limits if needed

## Support

For deployment issues, contact support or check the documentation.

