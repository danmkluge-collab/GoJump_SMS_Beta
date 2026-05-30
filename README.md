# GoJump America — Safety Management System (SMS)

**FAA 14 CFR Part 5 compliant Safety Management System for four GoJump America skydiving locations.**

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally (or use Docker)
- npm

### 1. Clone & configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, and optionally SMTP credentials
```

### 2. Install dependencies
```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 3. Run database migrations and seed
```bash
cd server
npx prisma migrate dev --name init
node prisma/seed.js
```

This seeds:
- 4 locations (Oceanside, Hawaii, Las Vegas, New York)
- QR codes saved to `/server/public/qr/*.png`
- Test users for every role
- Pre-populated risk register (H-001 through H-005 per location)
- Default KPIs for each location
- Sample hazard reports

### 4. Start servers
```bash
# Terminal 1 — backend (port 4000)
cd server && npm run dev

# Terminal 2 — frontend (port 3000)
cd client && npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Docker Compose (All-in-one)

```bash
cp .env.example .env
docker-compose up --build
```

Services:
- PostgreSQL → `localhost:5432`
- API server → `localhost:4000`
- React client → `localhost:3000`

---

## Test Credentials

All accounts use password: **`GoJump2024!`**

| Email | Role | Location |
|-------|------|----------|
| admin@gojumpamerica.com | Admin | All locations |
| sta.oceanside@gojump.com | S&TA | Oceanside |
| staff.oceanside@gojump.com | Staff | Oceanside |
| sta.hawaii@gojump.com | S&TA | Hawaii |
| sta.lasvegas@gojump.com | S&TA | Las Vegas |
| sta.newyork@gojump.com | S&TA | New York |

---

## Anonymous Hazard Reporting (QR Code)

No login required. Each location has a unique QR code:

| Location | URL |
|----------|-----|
| Oceanside | `http://localhost:4000/report?location=oceanside` |
| Hawaii | `http://localhost:4000/report?location=hawaii` |
| Las Vegas | `http://localhost:4000/report?location=las-vegas` |
| New York | `http://localhost:4000/report?location=new-york` |

QR code PNGs are generated at `/server/public/qr/`. Download them from the admin panel (QR Codes page) and print for each dropzone.

---

## Feature Summary

| Feature | FAA Reference | Access |
|---------|--------------|--------|
| Hazard Report Form (public, QR) | §5.91, §5.93 | Public |
| Risk Register with matrix | §5.5, §5.7, §5.91 | Staff+ |
| Incident tracking (lifecycle) | §5.7, §5.9 | Staff+ |
| Safety Dashboard + KPIs | §5.7, §5.9, §5.75 | Staff+ |
| Document storage + approval workflow | §5.3, §5.95, §5.97 | Staff+ |
| ERP contacts + exercise log | §5.17, §5.91 | Staff+ |
| Safety committee meeting log | §5.7, §5.9 | S&TA+ |
| Internal audit module | §5.7, §5.9 | S&TA+ |
| Audit log (immutable) | §5.7, §5.9, §5.95, §5.97 | S&TA+ |
| QR code generation | — | Admin |
| User management | — | Admin |
| Email notifications (Nodemailer) | §5.7, §5.9, §5.91 | Auto |
| Just Culture anonymous reporting | §5.91, §5.93, §5.95 | Public |

---

## Architecture

```
gojump-sms/
├── client/           React + Tailwind CSS
│   ├── src/
│   │   ├── pages/    All page components
│   │   ├── components/common/   Shared UI (Sidebar, Modal, Badges...)
│   │   ├── context/  AuthContext (JWT)
│   │   └── utils/    API client, helpers, risk matrix
│   └── Dockerfile
├── server/           Node.js + Express
│   ├── src/
│   │   ├── routes/   One file per resource
│   │   ├── middleware/ auth, audit, upload, error
│   │   ├── services/ emailService, notificationScheduler
│   │   └── utils/    prisma, logger, riskMatrix
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | JWT signing secret (32+ chars) | — |
| `PORT` | Server port | 4000 |
| `SMTP_HOST` | SMTP server (Mailtrap for dev) | smtp.mailtrap.io |
| `SMTP_PORT` | SMTP port | 587 |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `FROM_EMAIL` | From address for notifications | sms@gojumpamerica.com |
| `CLIENT_URL` | Frontend URL (for CORS) | http://localhost:3000 |
| `PUBLIC_BASE_URL` | Public server URL (for QR links) | http://localhost:4000 |
| `REACT_APP_API_URL` | API base URL for client | /api |

---

## Email Notifications

Configure SMTP credentials in `.env`. For local development, use [Mailtrap](https://mailtrap.io) (free).

Notifications fire automatically for:
- New hazard report submitted → S&TA email
- High/Critical risk item created → S&TA email
- Overdue incident actions → Daily digest at 8 AM (cron)

---

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET` (32+ random characters)
3. Configure real SMTP (SendGrid, AWS SES, etc.)
4. Set `PUBLIC_BASE_URL` to your domain for QR codes
5. Use a managed PostgreSQL instance (AWS RDS, Supabase, etc.)
6. Set `CLIENT_URL` to your frontend domain
7. Run `docker-compose up -d` or deploy separately

---

## FAA Part 5 Compliance Notes

This system is designed to support compliance with **14 CFR Part 5 — Safety Management Systems**:

- **§5.3** — Safety policy documented and stored
- **§5.5** — Hazard identification via reporting forms and risk register
- **§5.7 / §5.9** — Risk assessment, monitoring, and trending
- **§5.17** — Emergency response plan with exercise tracking
- **§5.75** — Configurable KPIs per location
- **§5.91** — Hazard reporting with Just Culture protections
- **§5.93** — Anonymous reporting mechanism
- **§5.95** — Risk register with likelihood × consequence matrix
- **§5.97** — Audit trail (immutable logs, 5-year retention requirement)

> **Disclaimer:** This software assists with SMS documentation and tracking. It does not constitute legal compliance advice. Operators remain responsible for meeting all applicable FAA regulations.
