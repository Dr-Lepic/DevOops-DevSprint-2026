# Notification Hub

Real-time notification service using Socket.io for order status updates.

## Features

- Socket.io server for real-time communication
- Room-based notifications (students join their own room)
- REST endpoint for kitchen worker to send notifications
- CORS-enabled for frontend connections

## Environment Variables

- `PORT`: Server port (default: 3003)
- `NODE_ENV`: Environment (default: development)
- `CORS_ORIGIN`: Allowed CORS origin (default: http://localhost:3004)

## API Endpoints

### POST /notify
Internal endpoint for kitchen worker to broadcast notifications.

**Request:**
```json
{
  "studentId": "2100411",
  "orderId": "abc-123",
  "status": "Ready"
}
```

**Response:**
```json
{
  "message": "Notification broadcasted"
}
```

### GET /health
Health check endpoint.

## Socket.io Events

### Client -> Server
- `joinRoom(studentId)`: Join a room for receiving notifications

### Server -> Client
- `orderStatusUpdate`: Order status update notification
  ```json
  {
    "orderId": "abc-123",
    "status": "Ready",
    "timestamp": "2026-02-28T10:00:00.000Z"
  }
  ```

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```
