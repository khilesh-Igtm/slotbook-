# Slotbook Product Walkthrough & Screenshot Checklist

This guide provides a structured 60-second walkthrough script, an evaluation guide, and a comprehensive screenshot checklist covering every user flow in **Slotbook**.

---

## 1. 60-Second Walkthrough Script

| Timestamp | Screen / Action | What to Demonstrate | Key Features Highlighted |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:10** | **Landing Page (`/`)** | Open the home page. View value proposition, feature grid, and public host directory. | Modern SaaS UI, host profile cards. |
| **0:10 – 0:20** | **Host Profile (`/book/alex-sharma`)** | Click on *Alex Sharma*. View host avatar, timezone badge (`Asia/Kolkata`), and available meeting types. Select *30-Minute Meeting*. | Real-time IANA timezone display, event cards with duration & Google Meet location badges. |
| **0:20 – 0:32** | **Slot Selection & Booking** | Select an upcoming weekday on the interactive calendar. Pick an available slot (e.g. `09:30 AM`). Enter guest name (`Jordan Smith`) and email (`jordan@example.com`). Click *Confirm Booking*. | Real-time slot generation, buffer calculation, transactional booking with GiST exclusion concurrency protection. |
| **0:32 – 0:40** | **Confirmation & Guest Cancellation** | View instant confirmation page (`/bookings/[bookingId]`). Click *Cancel Appointment*, enter reason, and confirm. | Booking status badge (`CONFIRMED` → `CANCELLED`), secure cancellation key authorization. |
| **0:40 – 0:50** | **Host Login & Dashboard (`/dashboard`)** | Navigate to `/login`. Sign in using `alex.slotbook@example.com` / `SlotbookDev2026!`. Inspect upcoming bookings and statistics. | Rate-limited authentication (5 attempts / 15 min), secure session cookie, responsive sidebar navigation. |
| **0:50 – 1:00** | **Availability & Worker Observability** | Open *Weekly Availability* and *Date Overrides* (Christmas Eve/Day rules). Show terminal running background worker (`npm run worker`) processing notification queues with lease management. | Recurring schedule editor, date-specific overrides, durable PostgreSQL queue with `SKIP LOCKED`. |

---

## 2. Screenshot Checklist

Use this checklist when capturing visual assets for documentation or presentation:

### Public Guest Journey
- [ ] **1. Landing Page (`/`)**: Hero section, concurrency guarantee callout, and public host directory list.
- [ ] **2. Host Public Profile (`/book/alex-sharma`)**: Host header with avatar, bio, timezone (`Asia/Kolkata`), and event type cards (`30-Minute Meeting`, `60-Minute Consultation`).
- [ ] **3. Date Picker & Time Slots (`/book/alex-sharma/30-min-meeting`)**: Split-view calendar showing selectable dates, unavailable dates greyed out, and dynamic time slots.
- [ ] **4. Guest Details Form**: Input fields for Full Name and Email Address with real-time validation.
- [ ] **5. Booking Confirmation (`/bookings/[bookingId]`)**: Success checkmark, date/time in host and guest local time, meeting link, and cancellation button.
- [ ] **6. Guest Cancellation Confirmation**: Modal dialog confirming cancellation reason and updating status to `CANCELLED`.

### Host Administration Journey
- [ ] **7. Host Login Page (`/login`)**: Email and password login card with error handling and rate-limit warning.
- [ ] **8. Dashboard Overview (`/dashboard`)**: Metric cards (Upcoming, Confirmed, Cancelled), quick navigation, and recent appointments.
- [ ] **9. Event Types Management (`/dashboard/events`)**: List of active and inactive event types, duration tags, buffer intervals, and *New Event Type* modal.
- [ ] **10. Weekly Schedule Editor (`/dashboard/availability`)**: Monday–Sunday interval cards with start/end time pickers and multi-window support.
- [ ] **11. Date Overrides & Exceptions (`/dashboard/availability/exceptions`)**: Full-day holiday blocks (e.g. Christmas Day) and custom window exceptions (e.g. Christmas Eve 09:00–13:00).
- [ ] **12. Booking Detail & Notification History (`/dashboard/bookings/[bookingId]`)**: Booking details, guest contact, host cancellation action, and delivery history for confirmation & reminder emails.
- [ ] **13. Manual Notification Retry**: Retrying a `FAILED` notification job directly from the dashboard.

### Infrastructure & Developer Experience
- [ ] **14. Health Check Endpoint (`/health` & `/api/health`)**: JSON output showing `status: ok`, uptime, database connected, and round-trip query latency.
- [ ] **15. Multi-Service Terminal Running**: Split terminal showing Next.js web application (`npm run start`) and background worker (`npm run worker`).
- [ ] **16. Docker Compose Orchestration (`docker compose ps`)**: Status table showing `slotbook-db`, `slotbook-web`, and `slotbook-worker` in `healthy` state.

---

## 3. Interactive Evaluation Credentials

For recruiters and developers evaluating Slotbook locally or via Docker Compose:

- **Web Application URL**: `http://localhost:3000` (or `http://localhost:3005` in Docker)
- **Demo Host Profile**: `http://localhost:3000/book/alex-sharma`
- **Host Dashboard Login**: `http://localhost:3000/login`
- **Host Email**: `alex.slotbook@example.com`
- **Host Password (Local Dev)**: `SlotbookDev2026!`
- **Host Password (Docker Compose)**: `SlotbookDocker2026!`
- **Health Check**: `http://localhost:3000/health`

