# Health Check Endpoints

DWIGO provides comprehensive health check endpoints for monitoring, debugging, and service discovery.

## Endpoints

### `/api/health` - Full Health Check
Returns detailed system status including database, Redis, and configuration checks.

**Response Format:**
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-12-01T14:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful",
      "responseTime": "5ms"
    },
    "redis": {
      "status": "healthy" | "unavailable" | "not_configured",
      "message": "Redis connection successful",
      "responseTime": "2ms"
    },
    "configuration": {
      "status": "healthy",
      "message": "All critical configuration present",
      "details": {
        "database": true,
        "jwtSecret": true,
        "adminToken": true,
        "openaiKey": "configured",
        "googlePlacesKey": "configured"
      }
    }
  }
}
```

**HTTP Status Codes:**
- `200` - Healthy or Degraded (service is operational)
- `503` - Unhealthy (critical services are down)

### `/health` - Simple Health Check
Lightweight endpoint for load balancers and monitoring tools.

**Query Parameters:**
- `detailed=true` - Returns full health check details (same as `/api/health`)

**Response (simple):**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-01T14:00:00.000Z"
}
```

**Response (detailed):**
Same as `/api/health` when `?detailed=true` is added.

## Use Cases

### 1. **Render Health Checks**
Configure Render to use `/health` as the health check URL:
- Settings → Health Check Path: `/health`
- Render will ping this endpoint every 30 seconds
- Service will restart if health check fails

### 2. **Monitoring & Alerting**
Set up external monitoring (UptimeRobot, Pingdom, etc.) to check `/api/health`:
- Alert on `503` status codes
- Monitor response times
- Track configuration status

### 3. **CI/CD Pipelines**
Use in deployment scripts to verify service is ready:
```bash
curl -f http://your-api.com/api/health || exit 1
```

### 4. **Debugging**
Check system status when troubleshooting:
```bash
curl http://your-api.com/api/health | jq
```

## Health Status Meanings

- **healthy**: All critical services operational
- **degraded**: Some optional services unavailable (e.g., Redis), but core functionality works
- **unhealthy**: Critical services down (database, missing config) - service should not serve traffic

## Configuration Checks

The health check verifies presence (not validity) of:
- ✅ `DATABASE_URL` - Required
- ✅ `JWT_SECRET` - Required
- ✅ `ADMIN_API_TOKEN` - Required
- ⚠️ `OPENAI_API_KEY` - Optional (needed for AI features)
- ⚠️ `GOOGLE_PLACES_API_KEY` - Optional (needed for merchant validation)
- ⚠️ `REDIS_URL` - Optional (needed for job queues)

## Notes

- Health checks are **read-only** and do not modify data
- Database check performs a simple `SELECT 1` query
- Redis check is optional and failures don't affect overall health
- Configuration checks verify presence, not validity of values
- Response times are included for performance monitoring

