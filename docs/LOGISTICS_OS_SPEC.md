# Vega Logistics OS — Enterprise Platform Specification

**Version:** 1.0 (2026-06)
**Target:** 50-vehicle fleet, scalable to 200+
**Author:** Vega Engineering
**Status:** Specification — for review prior to implementation

> This document describes the *target* platform. The current `vega-logistics-os` repo is a frontend-only executive dashboard with simulated data; this spec describes what is required to evolve it into a production enterprise logistics OS. Sections are split into **MVP** (must-ship for go-live) and **Advanced** (post-MVP, premium features).

---

## 1. Product Requirements

### 1.1 Vision
A unified, map-first operations platform for a real 50-vehicle Saudi logistics carrier. It is **not** a delivery tracking app — it is an *operating system* for the business: dispatch, safety, maintenance, finance, compliance, and customer experience on a single live map.

### 1.2 Business Goals
| # | Goal | Measurable Outcome |
|---|------|--------------------|
| 1 | Fleet visibility | 100% of vehicles GPS-visible in <60s of ignition |
| 2 | Delivery efficiency | +18% deliveries/vehicle/day vs. baseline |
| 3 | Driver safety | -40% harsh-driving events in 6 months |
| 4 | Fuel cost control | -8% fuel cost per km within 12 months |
| 5 | Maintenance planning | -25% unplanned downtime |
| 6 | Compliance & audit | 100% DVIR/HOS audit pass rate |
| 7 | Customer experience | NPS ≥ 45; 80%+ deliveries with live ETA shared |
| 8 | Operational analytics | <5s response on any KPI across any time window |

### 1.3 User Personas & Roles

| Role | Primary Surface | Top Tasks |
|------|----------------|-----------|
| **Super Admin** | Admin Panel | Tenants, users, roles, feature flags, billing |
| **Fleet Manager** | Web dashboard | KPI oversight, exception queue, approvals |
| **Dispatcher** | Web dashboard (map + dispatch board) | Assign jobs, monitor live ops, reroute |
| **Driver** | Mobile app (Android + iOS) | View jobs, navigate, capture POD, DVIR |
| **Warehouse Operator** | Tablet/Desktop | Pick, pack, load, scan, manifest |
| **Maintenance Technician** | Tablet | View work orders, log repairs, parts |
| **Customer Support** | Web portal | Search shipments, raise exceptions, comms |
| **Executive / Owner** | Web dashboard | High-level KPIs, ESG, finance, alerts |

### 1.4 Functional Requirements (must-have modules)

| # | Module | MVP | Advanced |
|---|--------|-----|----------|
| 1 | Fleet Tracking & Telematics | ✓ | |
| 2 | AI Safety / Driver Monitoring |  | ✓ |
| 3 | Route Planning & Dispatch | ✓ | |
| 4 | Maintenance Management | ✓ | |
| 5 | Fuel & Cost Control | ✓ | |
| 6 | Compliance (ELD/HOS, DVIR) | ✓ | |
| 7 | Delivery Management + POD | ✓ | |
| 8 | Customer Portal | ✓ | |
| 9 | Warehouse / Inventory (lite) |  | ✓ |
| 10 | Analytics & Reporting | ✓ | |

### 1.5 Non-Functional Requirements
- **Scale:** 50 vehicles at MVP; 200+ by Year 1; 1000+ by Year 3
- **Latency:** p95 API < 200ms; live map updates < 5s end-to-end
- **Availability:** 99.9% uptime SLA; 24h RTO, 1h RPO
- **Security:** TLS 1.2+; OAuth2/OIDC; per-tenant isolation; field-level encryption for PII
- **Auditability:** Every write produces an audit event with user, IP, before/after diff
- **i18n:** English + Arabic (RTL); ZATCA-compliant invoice format
- **Mobile:** Android 8+; iOS 15+; offline-first driver workflow with sync queue
- **Accessibility:** WCAG 2.1 AA on web dashboard
- **Data residency:** Saudi Arabia region (SDAIA/CCC compliance for sensitive workloads)

---

## 2. System Architecture

### 2.1 High-level Diagram

```
                ┌──────────────────────────┐
                │  Mobile Apps (Driver)    │  ← Android/iOS, offline-first
                └──────────┬───────────────┘
                           │ HTTPS / WSS
                ┌──────────▼───────────────┐
                │  CDN + WAF (CloudFront)  │
                └──────────┬───────────────┘
                           │
              ┌────────────▼─────────────┐
              │  API Gateway (Kong)      │  ← auth, rate limit, routing
              └────────────┬─────────────┘
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                  ┌─────────▼─────────┐
│  REST + GraphQL│                  │  Realtime (WSS)   │
│  Public APIs   │                  │  Live Map / Alerts│
└───────┬────────┘                  └─────────┬─────────┘
        │                                     │
        └──────────┬──────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Core Services      │
        │  (microservices)    │
        └──────────┬──────────┘
                   │
   ┌───────────┬───┴────┬──────────┬────────────┐
   │           │        │          │            │
┌──▼──┐  ┌─────▼──┐  ┌──▼──┐  ┌────▼────┐  ┌────▼────┐
│Post │  │Redis   │  │S3/  │  │TimeScale│  │Kafka /  │
│gres │  │Cache   │  │OSS  │  │DB (tel) │  │NATS     │
│+Pg  │  │+Session│  │Docs │  │metrics  │  │events   │
└─────┘  └────────┘  └─────┘  └─────────┘  └─────────┘
```

### 2.2 Service Boundaries

| Service | Responsibility |
|---------|----------------|
| **identity** | Auth, users, roles, RBAC, sessions, OAuth |
| **fleet** | Vehicles, devices, GPS pings, geofences |
| **dispatch** | Jobs, stops, routes, assignments |
| **driver** | Driver profiles, HOS, DVIR, scorecards |
| **safety** | Dashcam events, AI inference, coaching |
| **maintenance** | Work orders, parts, schedules, RUL |
| **fuel** | Fuel events, card integration, anomaly detection |
| **delivery** | POD, status lifecycle, exceptions |
| **warehouse** | Inventory, pick/pack, load plans |
| **billing** | Invoicing, ZATCA, customer pricing |
| **customer** | Portal, notifications, search |
| **analytics** | KPI rollups, OLAP, reports |
| **twin** | Digital twin simulator + scenario runner |
| **ai-agents** | Multi-agent coordinator (already prototyped in `src/lib/engines/agents.ts`) |
| **notify** | SMS/email/WhatsApp gateway |
| **audit** | Tamper-evident event log |

### 2.3 Real-time Strategy
- **Live vehicle telemetry:** MQTT broker (EMQX) → Kafka → TimescaleDB; clients subscribe via WSS gateway
- **Map updates:** Throttled to 1 update/vehicle/5s on web; live on dispatch
- **Alerts:** Push (FCM/APNS) for drivers; in-app for ops

### 2.4 Data Architecture
- **OLTP:** PostgreSQL 15 (one DB per service, joined via API or logical replica)
- **OLAP:** TimescaleDB / ClickHouse for telemetry and KPI rollups
- **Cache:** Redis 7 (sessions, hot fleet state, geofence checks)
- **Object storage:** S3-compatible (POD photos, dashcam clips, invoices)
- **Search:** OpenSearch (shipments, customers, audit)
- **Queue:** Kafka 3.x (events between services)

### 2.5 Multi-Tenancy
- **Strategy:** Shared DB, tenant_id column on every row; RLS policies in Postgres
- **Isolation:** Per-tenant KMS keys for sensitive columns (driver PII, customer PII)

---

## 3. Database Schema (logical)

All tables include `id uuid pk`, `tenant_id uuid fk`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid fk users`, `deleted_at timestamptz null` (soft delete). Sensitive tables have `row_version int` for optimistic locking and `etag uuid` for change detection.

### 3.1 Identity
- **users** (id, email, phone, full_name, password_hash, status, mfa_secret, last_login_at)
- **roles** (id, key, name, scopes jsonb)
- **user_roles** (user_id, role_id, scope_type, scope_id)  ← org/dept scoping
- **sessions** (id, user_id, ip, user_agent, expires_at, revoked_at)
- **api_keys** (id, tenant_id, name, hash, scopes, last_used_at)

### 3.2 Fleet
- **vehicles** (id, plate, make, model, year, vin, fuel_type, capacity_kg, capacity_m3, odometer_km, engine_hours, status, home_depot_id, telemetry_device_id, insurance_expiry, registration_expiry, iqama_expiry)
- **telemetry_devices** (id, vehicle_id, imei, model, firmware, last_seen_at, sim_iccid)
- **telemetry_pings** (vehicle_id ts, lat, lng, speed_kmh, heading, ignition, fuel_pct, odometer_km, engine_hrs, g_force, dtc_codes[]) — TimescaleDB hypertable, 1 row / 10s
- **geofences** (id, tenant_id, name, type, polygon geojson, alerts jsonb)
- **geofence_events** (id, vehicle_id, geofence_id, type, ts)
- **trips** (id, vehicle_id, driver_id, started_at, ended_at, start_loc, end_loc, distance_km, max_speed, idle_s, harsh_events int)

### 3.3 Dispatch
- **jobs** (id, customer_id, ref, type, status, priority, service_window_start, service_window_end, notes)
- **stops** (id, job_id, sequence, address, lat, lng, instructions, arrived_at, completed_at, exception_code)
- **routes** (id, vehicle_id, driver_id, planned_at, started_at, ended_at, polyline, distance_km, duration_s, optimization_version)
- **route_stops** (route_id, stop_id, sequence, eta_predicted, eta_actual)
- **dispatch_events** (id, job_id, type, payload jsonb, ts, actor_id)

### 3.4 Drivers
- **drivers** (id, user_id, license_no, license_class, license_expiry, iqama_no, iqama_expiry, photo_url, status, depot_id, hire_date)
- **driver_assignments** (id, driver_id, vehicle_id, shift_start, shift_end)
- **hos_logs** (id, driver_id, duty_status, ts, location) — ELD-compatible
- **hos_violations** (id, driver_id, rule, occurred_at, acknowledged_at)
- **dvir_reports** (id, driver_id, vehicle_id, type ['pre'|'post'], items jsonb, defects text, photos[], signed_at)
- **safety_scorecards** (driver_id, period_start, period_end, score, components jsonb)

### 3.5 Safety (advanced)
- **dashcam_events** (id, vehicle_id, ts, type ['harsh_brake'|'lane_departure'|'tailgate'|'distraction'|'fatigue'], severity, clip_url, thumbnail_url, lat, lng, speed_kmh)
- **coaching_sessions** (id, driver_id, event_id, coach_id, status, notes, signed_at)

### 3.6 Maintenance
- **maintenance_schedules** (id, vehicle_id, rule jsonb, last_done_at, next_due_at, next_due_km)
- **work_orders** (id, vehicle_id, type ['preventive'|'corrective'|'predictive'|'inspection'], priority, status, opened_at, closed_at, mileage, technician_id, cost_sar, parts jsonb, notes)
- **parts** (id, sku, name, stock_qty, reorder_level, unit_cost_sar)
- **work_order_parts** (work_order_id, part_id, qty, unit_cost_sar)
- **inspection_items** (id, name, category, severity)

### 3.7 Fuel
- **fuel_events** (id, vehicle_id, driver_id, ts, liters, cost_sar, station_name, odometer_km, source ['card'|'manual'|'sensor'], anomaly_flags jsonb)
- **fuel_cards** (id, vehicle_id, card_number, provider, status)

### 3.8 Delivery
- **pod** (id, stop_id, signature_url, photo_urls[], recipient_name, recipient_id_type, notes, gps_lat, gps_lng, captured_at)
- **delivery_exceptions** (id, stop_id, code, notes, photo_urls, resolved_at, resolution)

### 3.9 Customer
- **customers** (id, name, type, vat_number, cr_number, billing_email, billing_address)
- **shipments** (id, customer_id, ref, origin, destination, status, eta_promised, eta_predicted, weight_kg, dims, special_handling)
- **tracking_events** (id, shipment_id, ts, type, location, payload)
- **customer_users** (id, customer_id, user_id, scopes)

### 3.10 Warehouse (advanced)
- **warehouses** (id, name, address, lat, lng)
- **inventory** (id, warehouse_id, sku, qty, reserved_qty, location_bin)
- **pick_lists** (id, job_id, status, picker_id)
- **load_plans** (id, vehicle_id, manifest jsonb, loaded_at, verified_by)

### 3.11 Billing
- **invoices** (id, customer_id, period_start, period_end, amount_sar, vat_sar, status, zatca_uuid, zatca_hash, xml_url, pdf_url)
- **invoice_lines** (invoice_id, description, qty, unit_price_sar, vat_rate)

### 3.12 Audit
- **audit_log** (id, tenant_id, actor_id, actor_type, action, resource, resource_id, before jsonb, after jsonb, ip, ua, ts)
  - Append-only, write-once, mirrored to immutable bucket daily

---

## 4. API Endpoints (REST, JSON over HTTPS)

All endpoints under `/api/v1`. Standard verbs, cursor-based pagination, ETag/If-Match optimistic concurrency, problem+json errors.

### 4.1 Identity
- `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`
- `GET  /users` · `POST /users` · `GET  /users/{id}` · `PATCH /users/{id}` · `DELETE /users/{id}`
- `GET  /roles` · `POST /users/{id}/roles`
- `GET  /audit?actor=&resource=&from=&to=`

### 4.2 Fleet
- `GET  /vehicles` · `POST /vehicles` · `GET  /vehicles/{id}` · `PATCH /vehicles/{id}`
- `GET  /vehicles/{id}/live` · `GET  /vehicles/{id}/telemetry?from=&to=`
- `GET  /vehicles/{id}/trips?from=&to=`
- `POST /geofences` · `GET  /geofences` · `GET  /geofences/{id}/events`

### 4.3 Dispatch
- `GET  /jobs?status=&driver=&date=` · `POST /jobs` (bulk upload supported) · `PATCH /jobs/{id}`
- `POST /jobs/{id}/assign` · `POST /jobs/{id}/reroute` · `POST /jobs/{id}/cancel`
- `GET  /routes/{id}` · `GET  /routes/{id}/live`
- `POST /dispatch/optimize` (params: stops, vehicle constraints, time windows, traffic) → returns route plan + score

### 4.4 Drivers
- `GET  /drivers` · `POST /drivers` · `PATCH /drivers/{id}`
- `GET  /drivers/{id}/hos` · `POST /drivers/{id}/hos` (log entry)
- `POST /dvir` · `GET  /dvir?vehicle=&driver=&date=`
- `GET  /drivers/{id}/scorecard?from=&to=`

### 4.5 Safety (advanced)
- `GET  /safety/events?severity=&type=&from=&to=`
- `GET  /safety/events/{id}/clip` (signed URL)
- `POST /safety/coaching` · `PATCH /safety/coaching/{id}`

### 4.6 Maintenance
- `GET  /work-orders?status=&vehicle=&technician=`
- `POST /work-orders` · `PATCH /work-orders/{id}` · `POST /work-orders/{id}/close`
- `GET  /vehicles/{id}/schedule`
- `GET  /parts` · `POST /parts` · `PATCH /parts/{id}` (adjust stock)

### 4.7 Fuel
- `POST /fuel/events` (ingest from card provider webhook)
- `GET  /fuel/events?vehicle=&driver=&from=&to=`
- `GET  /fuel/anomalies?from=&to=`

### 4.8 Delivery
- `POST /pod` (multipart: signature, photos, geolocation)
- `POST /stops/{id}/status` (state machine)
- `POST /stops/{id}/exception`

### 4.9 Customer
- `GET  /customer/shipments/{ref}` (public, scoped)
- `GET  /customer/shipments/{ref}/track` (public tracking events)

### 4.10 Warehouse (advanced)
- `GET  /inventory?warehouse=&sku=` · `POST /inventory/adjust`
- `POST /pick-lists` · `POST /pick-lists/{id}/complete`
- `POST /load-plans` · `POST /load-plans/{id}/verify`

### 4.11 Billing
- `POST /invoices` · `GET  /invoices/{id}` · `GET  /invoices/{id}/pdf`
- `POST /invoices/{id}/submit-zatca` (signs, hashes, posts to ZATCA)

### 4.12 Analytics
- `GET  /kpi/fleet?from=&to=&groupBy=`
- `GET  /kpi/delivery?from=&to=&groupBy=region|driver|vehicle`
- `GET  /kpi/safety?from=&to=`
- `GET  /kpi/fuel?from=&to=&groupBy=vehicle`
- `GET  /kpi/maintenance?from=&to=`

### 4.13 Realtime (WSS)
- `wss://realtime.vega.local/ws` — channels: `fleet:{tenant}`, `dispatch:{tenant}`, `alerts:{user}`

---

## 5. UI Screens List

### 5.1 Admin
1. Login · 2FA challenge
2. Admin home (system health)
3. Tenants · Users · Roles
4. Audit log explorer
5. Feature flags · API keys
6. Webhooks · Integrations

### 5.2 Executive Dashboard
1. KPI overview (revenue, OTIF, fleet utilization, safety, CO₂e)
2. P&L roll-up vs. plan
3. ESG / Net-Zero progress
4. Exception queue
5. Custom report builder

### 5.3 Fleet Manager
1. Live map (all vehicles, geofences, jobs)
2. Vehicle list + detail
3. Trip replay (timeline + map)
4. Exception dashboard (alerts inbox)
5. Driver scorecard explorer

### 5.4 Dispatcher
1. Dispatch board (Kanban: Unassigned → Planned → Assigned → In Progress → Done)
2. Route planner (drag-drop stops, optimize, assign)
3. Live map with jobs overlay
4. Communication center (driver chat, customer notes)
5. Shift handover

### 5.5 Driver (mobile)
1. Today's jobs list
2. Job detail (stops, navigation, contact)
3. Pre-trip DVIR
4. POD capture (signature, photo, geolocation)
5. Exception reporter
6. Earnings / settlements
7. Profile & documents

### 5.6 Maintenance
1. Work order queue
2. Vehicle maintenance timeline (Gantt)
3. Parts inventory
4. Predictive maintenance alerts (RUL)
5. Cost & downtime analytics

### 5.7 Fuel
1. Fuel events log
2. Anomalies inbox
3. Efficiency leaderboard
4. Cost analytics (per vehicle, driver, route)

### 5.8 Safety (advanced)
1. Dashcam event feed
2. Event detail (video + telemetry overlay)
3. Coaching workflow
4. Driver leaderboard

### 5.9 Customer Portal
1. Track shipment (live map + ETA)
2. Shipment history
3. POD download
4. Notification preferences

### 5.10 Warehouse (advanced)
1. Inventory grid
2. Pick list runner (mobile/tablet)
3. Load plan builder
4. Receiving · putaway

---

## 6. Feature Prioritization

### 6.1 MVP (Months 1-3) — must ship
1. Identity & RBAC (Auth, users, roles, sessions)
2. Fleet tracking (GPS ingest, live map, geofences, trips)
3. Driver management + DVIR
4. Dispatch (jobs, stops, route optimization, assignment)
5. Delivery (status lifecycle, POD)
6. Maintenance (schedules, work orders, parts)
7. Fuel (events, anomaly flags)
8. Compliance (HOS, audit log, document storage)
9. Customer portal (track, ETA, POD download, notify)
10. Analytics (KPI rollups, executive dashboard)
11. Web dashboard (responsive, dark, i18n EN/AR)

### 6.2 Advanced (Months 4-9) — premium
1. AI Safety (dashcam events, coaching workflow)
2. Predictive maintenance (RUL from telemetry)
3. WMS-lite (inventory, pick lists, load plans)
4. ZATCA integration (full e-invoicing)
5. Multi-tenant onboarding
6. Customer notifications via WhatsApp Business API
7. Carbon / ESG reporting (already prototyped)
8. Digital twin simulator (already prototyped)
9. RL route optimizer (already prototyped)
10. Multi-agent AI assistant (already prototyped)

### 6.3 Cut from scope (v2+)
- Native iOS app (use PWA first; native only if metrics demand)
- Full ELD certification in US/CA markets
- In-house freight brokerage
- 3PL marketplace features

---

## 7. Suggested Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Web frontend** | Next.js 16 (App Router) + React 19 + TypeScript | Already in repo; SSR/RSC; mature |
| **Mobile driver** | React Native (Expo) + Reanimated + MMKV | Single codebase; offline-first; OTA updates |
| **UI kit** | Tailwind 4 + shadcn/ui + lucide-react | Dark-first; RTL; small bundle |
| **Maps** | MapLibre GL + OpenStreetMap tiles (or Mapbox if budget allows) | No vendor lock; supports truck routing |
| **State** | TanStack Query + Zustand | Server cache + local state |
| **Realtime** | native WSS via gateway; Echo/Phoenix on backend | Battle-tested |
| **API gateway** | Kong or Tyk | Auth, rate limit, transforms |
| **Services** | Node.js 20 (NestJS or Fastify) | TS end-to-end; great ecosystem |
| **Jobs/queue** | BullMQ (Redis) + Kafka | Mixed latency needs |
| **DB OLTP** | PostgreSQL 15 + PostGIS | Geospatial, JSONB, RLS |
| **DB time-series** | TimescaleDB | Telemetry rollups, retention policies |
| **Cache** | Redis 7 | Hot fleet state, geofence checks |
| **Search** | OpenSearch | Customer/shipment search, audit |
| **Object store** | S3-compatible (MinIO locally; AWS S3 or Aliyun OSS in cloud) | POD photos, dashcam clips |
| **Auth** | Ory Kratos or Keycloak | OIDC, MFA, social |
| **Notifications** | Twilio (SMS/WhatsApp) + FCM/APNS | Saudi carrier coverage |
| **e-Invoicing** | ZATCA SDK (Saudi) | Compliance |
| **Telematics** | Teltonika / Ruptela / Queclink protocols | Common in KSA |
| **AI inference** | NVIDIA Triton or simple ONNX runtime | Dashcam events, RUL |
| **Observability** | OpenTelemetry + Grafana + Loki + Tempo | Vendor-neutral |
| **CI/CD** | GitHub Actions + ArgoCD (or Vercel for web) | Standard |
| **Cloud** | AWS Riyadh (me-central-1) or STC Cloud | Data residency |
| **Container** | Docker + Kubernetes (EKS) or simpler ECS | Scale-on-demand |

---

## 8. Development Roadmap

### Phase 0 — Foundations (Weeks 1-3)
- Monorepo setup (pnpm/turbo)
- Auth service, RBAC, audit log
- CI/CD, dev/staging/prod envs
- Design system (Tailwind 4 + shadcn), RTL primitives

### Phase 1 — MVP Core (Weeks 4-10)
- Fleet service + device ingest (MQTT)
- Live map UI (existing Vega map → production)
- Driver mobile (Expo) — DVIR, jobs, POD
- Dispatch board (web)
- Job/stop state machine
- Customer tracking portal (PWA)
- Maintenance MVP (schedules, work orders)
- Fuel ingest (webhook from card provider)
- ZATCA invoice flow (basic)

### Phase 2 — MVP Polish (Weeks 11-14)
- KPI rollups + executive dashboard
- Anomaly detection (fuel, geofence)
- Mobile offline sync hardening
- Load testing (1k jobs/hour, 50 vehicles live)
- Pen test + SOC2 prep

### Phase 3 — Advanced (Months 4-6)
- AI Safety (dashcam + inference)
- Predictive maintenance
- WMS-lite
- Digital twin UI
- AI agents (assistant UI for ops)
- WhatsApp Business + customer notify

### Phase 4 — Scale (Months 6-9)
- Multi-tenant
- 200+ vehicle load test
- ZATCA Phase 2 integration
- Native iOS app
- Public API for partners

---

## 9. Risks & Compliance

### 9.1 Regulatory (Saudi-specific)
- **ZATCA e-Invoicing:** Phase 2 (integration) required for B2B; must support XML/UBL, hashing, clearance API
- **CITC telematics licensing** for fleet connectivity
- **SDAIA PDPL** (Personal Data Protection Law) — driver & customer PII handling
- **SFDA / SASO** for any hazardous goods handling
- **Cross-border:** UAE/Bahrain GCC customs integration for cross-GCC lanes

### 9.2 Technical
- **Data quality** from GPS devices: noisy coordinates, dropped pings → smoothing + interpolation
- **Offline mobile** resilience: aggressive retry, conflict resolution
- **Time zones:** KSA is UTC+3 year-round — but drivers may cross into UTC+4 (UAE)
- **Fuel card provider lock-in:** design adapter pattern; support 2 providers from day 1
- **Dashcam storage cost:** 50 vehicles × 8h/day × 720p ≈ 4 TB/day → aggressive retention (keep raw 7 days, events only 90 days)
- **Real-time scaling:** WSS gateway is the bottleneck; horizontal scaling with sticky sessions

### 9.3 Operational
- **Change management:** Drivers will resist new mobile workflow → phased rollout, training videos in AR/EN
- **Customer adoption of portal:** start with proactive SMS/WhatsApp links to live tracking, not portal login
- **Data migration** from any existing system: idempotent importers with side-by-side shadow period

### 9.4 Security
- Threat model (STRIDE) on dispatch (re-assignment, route tampering) and POD (replay)
- Secrets in HashiCorp Vault or AWS Secrets Manager
- WAF + rate limiting on all public endpoints
- Pen test annually + on major releases

---

## 10. Polished Specification (Implementation-Ready Summary)

### 10.1 What we are building
A **map-first, multi-tenant, real-time logistics operating system** for a 50-vehicle Saudi carrier. The system unifies fleet tracking, dispatch, safety, maintenance, fuel, compliance, delivery, customer experience, and analytics on a single platform, with a serious mobile driver app and a serious web operations dashboard.

### 10.2 What we are NOT building
- A generic food-delivery-style app
- A consumer-facing marketplace
- A fleet *purchase* or leasing platform
- A driver HR / payroll system (integrate via API)

### 10.3 Acceptance Criteria (top 10)
1. **Live map** displays all 50 vehicles with position updated ≤ 5s after GPS ping
2. **Dispatcher** can create a 30-stop route in < 60s using optimize
3. **Driver** can complete POD (signature + photo + GPS) in < 30s on mobile, even offline
4. **Fleet Manager** can see the full trip replay of any vehicle for any past 90 days
5. **Maintenance** can issue a work order from a predictive alert, and parts inventory auto-decrements on close
6. **Fuel** auto-detects a card-swipe event with > 12% deviation from expected and flags it
7. **Compliance** generates a DVIR record per driver per shift, with defects routed to maintenance
8. **Customer portal** allows any shipment ref to be tracked live with no login
9. **Audit log** captures every state change with immutable before/after JSON
10. **Executive dashboard** loads in < 2s with 30-day KPIs across all modules

### 10.4 KPIs to track post-launch
- Mean time to assign (MTTA) job: < 5 min
- On-time delivery rate: ≥ 92%
- First-attempt delivery rate: ≥ 90%
- Average route distance saved vs. unoptimized: ≥ 8%
- Driver safety scorecard average: improving ≥ 5% per quarter
- Mean time between failures (MTBF) per vehicle: increasing
- Cost per km: decreasing 1% per quarter

### 10.5 First 5 implementation tickets
1. **AUTH-1:** Implement identity service with OIDC, RBAC, and audit log; expose `/api/v1/auth/*`
2. **FLEET-1:** MQTT ingest pipeline for Teltonika protocol → TimescaleDB; expose `/api/v1/vehicles/{id}/live`
3. **DISPATCH-1:** Jobs + stops CRUD; route optimization service (OR-Tools); dispatch board UI
4. **DRIVER-1:** Expo app skeleton with offline storage, job list, POD capture
5. **CUSTOMER-1:** Public tracking endpoint + PWA portal with live map

### 10.6 Where the existing Vega OS fits
The current `vega-logistics-os` repo is the **executive dashboard / digital twin / carbon view** layer. It is a strong *vertical-slice prototype* (financial engine, ghost-growth, advanced KPIs, 2026 AI/ML views). The recommended path is to:

1. Keep the existing frontend as the **analytics + executive layer**
2. Build the new **operational backend services** (auth, fleet, dispatch, etc.) in a sibling monorepo
3. Carve out a **driver mobile app** as a new Expo project
4. Stitch everything together with shared OpenAPI specs and a shared design system package

This avoids a costly rewrite and lets the team ship the operational MVP incrementally on top of proven analytics code.

---

## Appendix A — Glossary

| Term | Meaning |
|------|---------|
| **DVIR** | Driver Vehicle Inspection Report |
| **ELD/HOS** | Electronic Logging Device / Hours of Service |
| **POD** | Proof of Delivery |
| **RUL** | Remaining Useful Life |
| **ZATCA** | Zakat, Tax and Customs Authority (Saudi) |
| **GCC** | Gulf Cooperation Council |
| **RTL** | Right-to-Left (Arabic) |
| **SDAIA** | Saudi Data & AI Authority |
| **PDPL** | Personal Data Protection Law |

## Appendix B — References (2025-2026)

- Utilimarc 2026 Fleet Trends (https://www.utilimarc.com/blog/5-top-fleet-management-trends-in-2026)
- ZATCA e-Invoicing Phase 2 technical docs
- SDAIA PDPL guidance
- Mapbox / MapLibre / OSRM routing best practices
- OR-Tools vehicle routing solver
- Ory Kratos + OIDC patterns
