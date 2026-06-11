# 🚀 Xeno CRM – AI-Native Shopper Engagement Platform

An industrial-grade, AI-native Mini CRM built for the Xeno Engineering Take-Home Assignment.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React + Vite Frontend               │
│       (Dashboard / Customers / Segments / Campaigns /   │
│        Analytics / AI Chat)                             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│              Node.js + Express Backend (Port 4000)      │
│   Routes: customers · orders · segments · campaigns     │
│           receipts · analytics · ai · ingest            │
│   AI: Groq API (LLaMA 3.1 70B) via groq-sdk            │
│   Queue: BullMQ + Redis                                 │
│   ORM: Prisma + PostgreSQL                              │
└────────┬───────────────────────┬────────────────────────┘
         │ Dispatch jobs         │ Async callbacks
┌────────▼────────────┐ ┌───────▼────────────────────────┐
│   Redis (BullMQ)    │ │   Channel Stub Service (5000)  │
│   - campaign-       │ │   Simulates: whatsapp/sms/     │
│     dispatch queue  │ │   email/rcs delivery lifecycle │
│   - message-send    │ │   with realistic open/click/   │
│     queue           │ │   conversion rates + BullMQ    │
└─────────────────────┘ └────────────────────────────────┘
         │
┌────────▼────────────┐
│   PostgreSQL (5432)  │
│   Customers · Orders │
│   Segments · Members │
│   Campaigns · Comms  │
│   AI Conversations   │
└─────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **AI Segment Builder** | Describe your audience in plain English — Groq AI generates the rule set |
| **AI Campaign Creator** | Intent → auto channel suggestion, audience match, message draft |
| **AI Chat Assistant** | Streaming chat with context-aware CRM assistant (LLaMA 3.1 70B) |
| **Delivery Simulation** | Channel stub service with realistic per-channel delivery/open/click/conversion rates |
| **Async Callback Loop** | BullMQ-powered two-service callback system (CRM → Channel → CRM) |
| **RFM Cohorts** | Active / At Risk / Lapsing / Churned calculated via SQL at the DB |
| **Real-time Stats** | Campaigns auto-refresh while running |
| **Customer Timelines** | Per-customer order + communication history |
| **Bulk Ingestion** | REST API for batch importing customers and orders |
| **Demo Seed** | One-click seeding of 500 realistic Indian customers + orders |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Groq API key ([get one free](https://console.groq.com))

### 1. Clone & configure
```bash
git clone <your-repo-url>
cd xeno-crm
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 2. Start everything
```bash
docker compose up --build
```

### 3. Access
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Channel Service | http://localhost:5000 |
| API Health | http://localhost:4000/health |

### 4. Seed demo data
Click **"Seed Demo Data"** on the dashboard, or:
```bash
curl -X POST http://localhost:4000/api/ingest/seed \
  -H "Content-Type: application/json" \
  -d '{"count": 500}'
```

---

## 🛠️ Local Development (without Docker)

```bash
# Start postgres and redis via docker only
docker compose up postgres redis -d

# Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
cp ../.env.example .env  # fill in vars
npm run dev

# Channel service
cd channel-service
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📡 API Reference

### Customers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | List with pagination/search/sort |
| GET | `/api/customers/:id` | Customer detail with orders |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/stats/overview` | Aggregated stats |
| GET | `/api/customers/:id/timeline` | Order + comms timeline |

### Segments
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/segments` | List all segments |
| POST | `/api/segments` | Create manual segment |
| POST | `/api/segments/ai-generate` | AI-generate from prompt |
| POST | `/api/segments/preview` | Count without saving |
| POST | `/api/segments/:id/refresh` | Recompute members |

### Campaigns
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create draft |
| POST | `/api/campaigns/ai-create` | AI-create from intent |
| POST | `/api/campaigns/ai-message` | Generate message only |
| POST | `/api/campaigns/:id/launch` | Launch campaign |
| GET | `/api/campaigns/:id/stats` | Live stats |
| GET | `/api/campaigns/:id/insights` | AI performance analysis |

### AI
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/chat` | Streaming SSE chat |
| POST | `/api/ai/segment` | Generate segment rules |
| POST | `/api/ai/message` | Generate campaign message |
| POST | `/api/ai/suggest-channel` | Channel recommendation |

### Receipts
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/receipts/callback` | Called by channel service |
| GET | `/api/receipts/campaign/:id` | All receipts for campaign |

---

## 🧠 AI Design Decisions

- **Model:** `llama-3.1-70b-versatile` via Groq — fastest available 70B model for real-time UX
- **Segment generation:** AI outputs structured JSON rules, validated server-side before DB query
- **Chat:** Full SSE streaming with conversation history (last 10 turns) + live CRM context injected
- **Message drafting:** Channel-specific prompting (SMS ≤160 chars, WhatsApp emoji-friendly, etc.)
- **Insights:** Campaign stats fed to AI for post-campaign analysis with actionable recommendations

## ⚖️ Scale Tradeoffs

- **BullMQ queues:** Message dispatch is decoupled and retry-safe; concurrency is tunable
- **Batch inserts:** `createMany` used everywhere for bulk ops, never N+1 inserts
- **Postgres indexes:** Added on all query-hot columns (email, totalSpend, lastOrderAt, status, etc.)
- **Redis caching:** Dashboard data cached 2 min, cohorts 10 min — reduces DB load
- **Segment refresh:** Runs in background; `$transaction` ensures atomic member replacement
- **What I'd add at scale:** Read replicas, partition `communications` by month, ElasticSearch for customer search, Kafka instead of BullMQ for event fanout

---

## 📁 Project Structure

```
xeno-crm/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # Full data model
│   │   └── migrations/           # SQL migrations
│   └── src/
│       ├── index.js              # Express app
│       ├── routes/               # All route handlers
│       ├── services/
│       │   ├── groqService.js    # All Groq AI calls
│       │   ├── segmentEngine.js  # Rule evaluation engine
│       │   └── campaignDispatcher.js  # BullMQ workers
│       └── utils/               # logger, redis, prisma
├── channel-service/
│   └── src/index.js             # Stub service + delivery simulation
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, Customers, Segments, etc.
│       ├── components/          # Layout, shared components
│       └── services/api.js      # Axios API layer
└── docker-compose.yml
```
