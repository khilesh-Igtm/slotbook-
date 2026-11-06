# Slotbook API Documentation

Comprehensive reference for all implemented REST API endpoints in **Slotbook**.

---

## Table of Contents
1. [Overview & Conventions](#overview--conventions)
2. [Health & System Observability](#1-health--system-observability)
3. [Host Authentication](#2-host-authentication)
4. [Public Scheduling & Availability](#3-public-scheduling--availability)
5. [Guest Bookings & Cancellation](#4-guest-bookings--cancellation)
6. [Host Dashboard: Event Management](#5-host-dashboard-event-management)
7. [Host Dashboard: Weekly Availability](#6-host-dashboard-weekly-availability)
8. [Host Dashboard: Date Overrides & Exceptions](#7-host-dashboard-date-overrides--exceptions)
9. [Host Dashboard: Bookings & Cancellation](#8-host-dashboard-bookings--cancellation)
10. [Host Dashboard: Notification Management](#9-host-dashboard-notification-management)
11. [Host Dashboard: Settings & Profile](#10-host-dashboard-settings--profile)
12. [Standard Error Responses](#11-standard-error-responses)

---

## Overview & Conventions

- **Base URL**: `http://localhost:3000` (Local) or `https://slotbook.up.railway.app` (Production)
- **Content-Type**: `application/json` for all request and response bodies
- **Timestamps**: All timestamps in requests and responses use ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Authentication**: Host endpoints require an HTTP-only session cookie (`slotbook_session`) issued upon successful login via `POST /api/auth/login`.

---

## 1. Health & System Observability

### `GET /health` & `GET /api/health`
Probes active application runtime status and verifies PostgreSQL database query connectivity with latency measurement.

- **Authentication**: Public (None)
- **Headers**: None

#### Successful Response (`200 OK`)
```json
{
  "status": "ok",
  "timestamp": "2026-11-06T17:30:42.773Z",
  "uptime": 120,
  "database": {
    "status": "connected",
    "latencyMs": 4
  }
}
```

#### Degraded Response (`503 Service Unavailable`)
```json
{
  "status": "degraded",
  "timestamp": "2026-11-06T17:30:42.773Z",
  "database": {
    "status": "disconnected"
  }
}
```

---

## 2. Host Authentication

### `POST /api/auth/login`
Authenticates a host using email and password. Protected by a sliding-window rate limiter (5 failed attempts per 15 minutes per IP/email).

- **Authentication**: Public
- **Rate Limit**: Maximum 5 failures per 15 minutes. Returns `429 Too Many Requests` with `Retry-After: 900`.

#### Request Body
```json
{
  "email": "alex.slotbook@example.com",
  "password": "SlotbookDev2026!"
}
```

#### Successful Response (`200 OK`)
Sets `slotbook_session` cookie (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`).
```json
{
  "host": {
    "id": "cm3abc1230000xyz",
    "name": "Alex Sharma",
    "email": "alex.slotbook@example.com",
    "slug": "alex-sharma",
    "timezone": "Asia/Kolkata"
  },
  "message": "Login successful"
}
```

#### Error Responses
- `400 Bad Request`: Validation failure on email format or empty password.
- `401 Unauthorized`: Invalid credentials.
- `429 Too Many Requests`: Too many failed login attempts.

---

### `POST /api/auth/logout`
Terminates the host session and clears the authentication cookie.

- **Authentication**: Host Session Cookie
- **Request Body**: None

#### Successful Response (`200 OK`)
```json
{
  "message": "Logged out successfully"
}
```

---

### `GET /api/auth/me`
Returns profile information for the currently authenticated host.

- **Authentication**: Host Session Cookie

#### Successful Response (`200 OK`)
```json
{
  "host": {
    "id": "cm3abc1230000xyz",
    "name": "Alex Sharma",
    "email": "alex.slotbook@example.com",
    "slug": "alex-sharma",
    "timezone": "Asia/Kolkata"
  }
}
```

#### Error Response
- `401 Unauthorized`: Missing or expired session cookie.

---

## 3. Public Scheduling & Availability

### `GET /api/hosts/:hostId/event-types`
Fetches all active appointment event types offered by the host.

- **Authentication**: Public
- **URL Parameters**:
  - `hostId` (string, required): Unique Host UUID/CUID

#### Successful Response (`200 OK`)
```json
{
  "host": {
    "id": "cm3abc1230000xyz",
    "name": "Alex Sharma",
    "email": "alex.slotbook@example.com",
    "slug": "alex-sharma",
    "timezone": "Asia/Kolkata"
  },
  "eventTypes": [
    {
      "id": "cm3evt30min0001",
      "hostId": "cm3abc1230000xyz",
      "title": "30-Minute Meeting",
      "slug": "30-min-meeting",
      "description": "Quick 30-minute sync or discussion session.",
      "duration": 30,
      "bufferBefore": 5,
      "bufferAfter": 5,
      "location": "Google Meet",
      "isActive": true
    }
  ]
}
```

---

### `GET /api/hosts/:hostId/event-types/:eventTypeId/availability?date=YYYY-MM-DD`
Computes all available start times on a target date, respecting weekly hours, date overrides, existing bookings, buffer intervals, past times, and host timezone rules.

- **Authentication**: Public
- **Query Parameters**:
  - `date` (string, required): Target date formatted as `YYYY-MM-DD`

#### Successful Response (`200 OK`)
```json
{
  "date": "2026-12-24",
  "hostTimezone": "Asia/Kolkata",
  "slotDuration": 30,
  "bufferBefore": 5,
  "bufferAfter": 5,
  "slots": [
    {
      "startUtc": "2026-12-24T03:30:00.000Z",
      "endUtc": "2026-12-24T04:00:00.000Z",
      "localStart": "09:00",
      "localEnd": "09:30",
      "available": true
    },
    {
      "startUtc": "2026-12-24T04:00:00.000Z",
      "endUtc": "2026-12-24T04:30:00.000Z",
      "localStart": "09:30",
      "localEnd": "10:00",
      "available": false
    }
  ]
}
```

---

## 4. Guest Bookings & Cancellation

### `POST /api/bookings`
Reserves an appointment slot. Protected by PostgreSQL GiST exclusion constraints (`btree_gist`) to guarantee zero double bookings under high concurrency. Supports idempotent retries.

- **Authentication**: Public
- **Headers**:
  - `Idempotency-Key` (string, optional): Client-generated unique UUID to prevent duplicate charges/bookings on network retries.

#### Request Body
```json
{
  "hostId": "cm3abc1230000xyz",
  "eventTypeId": "cm3evt30min0001",
  "guestName": "Jordan Smith",
  "guestEmail": "jordan.smith@example.com",
  "startAt": "2026-12-24T03:30:00.000Z"
}
```

#### Successful Response (`201 Created`)
```json
{
  "booking": {
    "id": "cm3bk0001xyz",
    "hostId": "cm3abc1230000xyz",
    "eventTypeId": "cm3evt30min0001",
    "guestName": "Jordan Smith",
    "guestEmail": "jordan.smith@example.com",
    "startAt": "2026-12-24T03:30:00.000Z",
    "endAt": "2026-12-24T04:00:00.000Z",
    "reservedStartAt": "2026-12-24T03:25:00.000Z",
    "reservedEndAt": "2026-12-24T04:05:00.000Z",
    "status": "CONFIRMED",
    "cancellationKey": "c7a8b9e0-1234-5678-90ab-cdef12345678",
    "createdAt": "2026-11-06T17:30:00.000Z"
  }
}
```

#### Error Responses
- `400 Bad Request`: Invalid email, past time requested, or slot outside host schedule.
- `409 Conflict`: The slot (or required buffer interval) is already booked by another user (`SlotConflictError`).

---

### `GET /api/bookings/:bookingId`
Retrieves public status and details for an existing booking confirmation page.

- **Authentication**: Public

#### Successful Response (`200 OK`)
```json
{
  "booking": {
    "id": "cm3bk0001xyz",
    "guestName": "Jordan Smith",
    "guestEmail": "jordan.smith@example.com",
    "startAt": "2026-12-24T03:30:00.000Z",
    "endAt": "2026-12-24T04:00:00.000Z",
    "status": "CONFIRMED",
    "host": {
      "name": "Alex Sharma",
      "timezone": "Asia/Kolkata"
    },
    "eventType": {
      "title": "30-Minute Meeting",
      "duration": 30,
      "location": "Google Meet"
    }
  }
}
```

---

### `POST /api/bookings/:bookingId/cancel`
Allows a guest to securely cancel their appointment using their unique `cancellationKey`. Releases the time slot and immediately queues cancellation notification emails.

- **Authentication**: Public (requires secret `cancellationKey` in body)

#### Request Body
```json
{
  "cancellationKey": "c7a8b9e0-1234-5678-90ab-cdef12345678",
  "reason": "Rescheduling due to travel."
}
```

#### Successful Response (`200 OK`)
```json
{
  "booking": {
    "id": "cm3bk0001xyz",
    "status": "CANCELLED",
    "cancellationReason": "Rescheduling due to travel."
  },
  "message": "Booking cancelled successfully"
}
```

#### Error Responses
- `401 Unauthorized`: Missing or incorrect cancellation key.
- `400 Bad Request`: Booking is already cancelled (`InvalidStateTransitionError`).

---

## 5. Host Dashboard: Event Management

### `GET /api/dashboard/events`
Returns all event types owned by the authenticated host (including inactive types).

- **Authentication**: Host Session Cookie

---

### `POST /api/dashboard/events`
Creates a new event type for the host.

- **Authentication**: Host Session Cookie

#### Request Body
```json
{
  "title": "Design Review",
  "slug": "design-review",
  "description": "Portfolio or UI/UX design critique session.",
  "duration": 45,
  "bufferBefore": 10,
  "bufferAfter": 10,
  "location": "Zoom",
  "isActive": true
}
```

#### Successful Response (`201 Created`)
Returns created `eventType` record.

---

### `PATCH /api/dashboard/events/:eventTypeId`
Updates an existing event type. Host isolation enforced: hosts cannot modify other hosts' events.

- **Authentication**: Host Session Cookie

---

### `DELETE /api/dashboard/events/:eventTypeId`
Deactivates or deletes an event type.

- **Authentication**: Host Session Cookie

---

## 6. Host Dashboard: Weekly Availability

### `GET /api/dashboard/availability`
Returns the weekly recurring schedule for the authenticated host.

- **Authentication**: Host Session Cookie

#### Successful Response (`200 OK`)
```json
{
  "availabilities": [
    {
      "id": "cm3av001",
      "dayOfWeek": "MONDAY",
      "startTime": "09:00",
      "endTime": "17:00"
    },
    {
      "id": "cm3av002",
      "dayOfWeek": "TUESDAY",
      "startTime": "09:00",
      "endTime": "17:00"
    }
  ]
}
```

---

### `PUT /api/dashboard/availability`
Atomically replaces the host's entire weekly schedule within a transaction.

- **Authentication**: Host Session Cookie

#### Request Body
```json
{
  "availabilities": [
    { "dayOfWeek": "MONDAY", "startTime": "10:00", "endTime": "18:00" },
    { "dayOfWeek": "WEDNESDAY", "startTime": "10:00", "endTime": "18:00" },
    { "dayOfWeek": "FRIDAY", "startTime": "10:00", "endTime": "16:00" }
  ]
}
```

#### Successful Response (`200 OK`)
Returns updated `availabilities` array.

---

## 7. Host Dashboard: Date Overrides & Exceptions

### `GET /api/dashboard/exceptions`
Returns all specific date overrides configured by the host.

- **Authentication**: Host Session Cookie

---

### `POST /api/dashboard/exceptions`
Adds a date-specific override (e.g. marking a holiday as unavailable, or offering custom hours on a specific day).

- **Authentication**: Host Session Cookie

#### Request Body (Full-Day Block)
```json
{
  "date": "2026-12-25",
  "isUnavailable": true
}
```

#### Request Body (Custom Hours)
```json
{
  "date": "2026-12-24",
  "isUnavailable": false,
  "startTime": "09:00",
  "endTime": "13:00"
}
```

#### Successful Response (`201 Created`)
Returns created `DateOverride` record.

---

### `DELETE /api/dashboard/exceptions/:overrideId`
Removes a date override.

- **Authentication**: Host Session Cookie

---

## 8. Host Dashboard: Bookings & Cancellation

### `GET /api/dashboard/bookings?status=CONFIRMED`
Returns bookings for the host, optionally filtered by status (`CONFIRMED`, `CANCELLED`).

- **Authentication**: Host Session Cookie

---

### `GET /api/dashboard/bookings/:bookingId`
Retrieves detailed information for a single booking, including associated notification job history.

- **Authentication**: Host Session Cookie

---

### `POST /api/dashboard/bookings/:bookingId/cancel`
Allows a host to cancel an appointment directly from their dashboard without needing the guest's cancellation key.

- **Authentication**: Host Session Cookie

#### Request Body
```json
{
  "reason": "Host emergency leave."
}
```

---

## 9. Host Dashboard: Notification Management

### `POST /api/dashboard/bookings/:bookingId/notifications/:notificationId/retry`
Allows a host to manually re-enqueue a failed notification job. Resets status to `PENDING`, sets `attemptCount = 0`, and schedules immediate pickup by the background worker.

- **Authentication**: Host Session Cookie
- **Authorization**: Host can only retry notifications belonging to their own bookings.

#### Successful Response (`200 OK`)
```json
{
  "notification": {
    "id": "cm3notif001",
    "status": "PENDING",
    "attemptCount": 0,
    "nextAttemptAt": "2026-11-06T17:35:00.000Z"
  },
  "message": "Notification re-queued for processing"
}
```

---

## 10. Host Dashboard: Settings & Profile

### `GET /api/dashboard/settings`
Returns current host account settings.

- **Authentication**: Host Session Cookie

---

### `PATCH /api/dashboard/settings`
Updates host profile name or IANA timezone.

- **Authentication**: Host Session Cookie

#### Request Body
```json
{
  "name": "Alex Sharma",
  "timezone": "Asia/Kolkata"
}
```

---

## 11. Standard Error Responses

All error responses return structured JSON:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

| HTTP Status | Error Type / Code | Description |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request payload fails Zod schema validation |
| `401` | `UNAUTHORIZED` | Invalid credentials or missing authentication session |
| `403` | `FORBIDDEN` | Attempting to access or mutate another host's resources |
| `404` | `NOT_FOUND` | The requested entity (host, event type, booking) does not exist |
| `409` | `SLOT_CONFLICT` | Overlapping booking or buffer interval violation |
| `429` | `TOO_MANY_REQUESTS` | Exceeded rate limit (login brute force defense) |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure |
| `503` | `SERVICE_UNAVAILABLE` | Database connectivity failure reported by `/health` |

