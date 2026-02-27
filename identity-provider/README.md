# Identity Provider Service

This service handles authentication and JWT token generation for the DevSprint 2026 cafeteria system.

## Features

- JWT-based authentication
- Rate limiting (3 requests per minute per student/IP)
- Redis-backed rate limiting for distributed systems
- Mock user database for testing

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
JWT_SECRET=supersecret2026
REDIS_URL=redis://redis:6379
PORT=3001
NODE_ENV=development
```

Production defaults can use `NODE_ENV=production`.

## Mock Users

For testing, the following users are available:

- studentId: `2100411`, password: `password123`
- studentId: `2100412`, password: `password123`
- studentId: `2100413`, password: `password123`
- studentId: `admin`, password: `admin123`

## API Endpoints

### POST /login

Login and receive a JWT token.

**Request:**
```json
{
  "studentId": "2100411",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOi...",
  "studentId": "2100411"
}
```

**Error Responses:**
- `400 Bad Request`: Missing studentId or password
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded (3 requests/minute)

### GET /health

Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "identity-provider"
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t identity-provider .

# Run container
docker run -p 3001:3001 --env-file .env identity-provider

# Verify health
docker ps
```
