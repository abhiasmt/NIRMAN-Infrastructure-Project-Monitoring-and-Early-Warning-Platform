# NIRMAN

**AI-Powered Infrastructure Project Monitoring and Early-Warning Platform**
*Predict. Prioritise. Prevent.*

Smart India Hackathon 2026 · Problem Statement **SIH26103** · Ministry of Statistics &
Programme Implementation (MoSPI) · Theme: Smart Automation · Category: Software

> This prototype uses synthetic CUF-like infrastructure project data for SIH demonstration.
> It does not use confidential or live PAIMANA/OCMS data.

---

## 1. Project overview

NIRMAN converts periodic project returns into an early-warning signal. For every Central
Sector infrastructure project it produces a delay-risk probability, a cost-overrun-risk
probability, an overall 0–100 risk score, the project-specific factors behind that score,
and a suggested focus for the reviewing officer.

The officer, not the model, decides what happens next. Output is always presented as
predicted risk, early-warning indicators and decision support.

## 2. Problem statement

Infrastructure monitoring today is largely retrospective. A status report shows that a
project has slipped; it does not rank which projects are likely to slip next, or say which
data-backed factors are driving that risk. With hundreds of projects under review, officers
must prioritise manually.

NIRMAN addresses three gaps: **late identification**, **manual prioritisation**, and
**limited root-cause visibility**.

## 3. Features

- Delay-risk and cost-overrun-risk prediction per project
- Overall risk score (0–100) and risk band: Low / Medium / High / Critical
- Explainable risk drivers, worded for a review note rather than a model dump
- Suggested review focus derived from the drivers
- Portfolio dashboard by ministry, sector, state and agency
- Alert centre with eight rule-based early-warning types
- Intervention tracking from assignment to closure
- CSV import of periodic returns with row-level validation
- Configurable thresholds and scoring weights
- Role-based access control across six roles
- Audit log for project edits, alert actions and intervention updates

## 4. Architecture

```
                 Synthetic CUF-like data / authorised PAIMANA data
                                      |
                        CSV import  +  periodic returns
                                      |
              +-----------------------v------------------------+
              |     Node.js + Express REST API (/api/v1)        |
              |     JWT auth · RBAC · Zod validation · audit    |
              +------+--------------------------+---------------+
                     |                          |
        +------------v-----------+   +----------v-------------+
        |  PostgreSQL (Prisma)   |   |  Python FastAPI ML     |
        |  projects, milestones, |   |  feature engineering,  |
        |  predictions, alerts,  |   |  delay + cost models,  |
        |  interventions, audit  |   |  SHAP / rule explains  |
        +------------------------+   +------------------------+
                     |
        +------------v-----------------------------------------+
        |  Web dashboard — portfolio, projects, alerts,         |
        |  interventions, upload, analytics, model, settings    |
        +-------------------------------------------------------+
```

## 5. Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JS (no build step), Inter, hand-rolled SVG charts |
| API | Node.js, Express, JWT, bcrypt, Zod, Multer, node-cron, Swagger UI |
| Database | PostgreSQL 16, Prisma ORM |
| ML service | Python 3.11, FastAPI, pandas, NumPy, scikit-learn, XGBoost (optional), SHAP (optional), joblib |
| Deployment | Docker, Docker Compose |

## 6. Folder structure

```
nirman/
├── web/                      # dashboard + landing page (no build step)
│   ├── index.html            # landing page
│   ├── app.html              # authenticated dashboard
│   ├── css/{styles,landing}.css
│   └── js/{core,data,views,app}.js
├── server/                   # Express API
│   ├── prisma/{schema.prisma,seed.js}
│   └── src/
│       ├── index.js
│       ├── routes/           # auth, projects, dashboard, predictions,
│       │                     # alerts, interventions, uploads, admin
│       ├── middleware/       # auth (JWT + RBAC), validate (Zod)
│       └── lib/              # prisma, riskService, audit, openapi
├── ml-service/               # FastAPI risk engine
│   ├── app/{main,train,features,explain}.py
│   ├── models/               # joblib artefacts (created by training)
│   └── requirements.txt
├── data/
│   ├── synthetic_projects.csv          # 400 seeded projects
│   └── project_update_template.csv     # CSV upload template
└── docker-compose.yml
```

## 7. Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 16 (or Docker)
- Docker + Docker Compose (optional, for the one-command path)

## 8. Quick start with Docker

```bash
docker compose up --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

| Service | URL |
|---|---|
| Web UI | http://localhost:8080 |
| API | http://localhost:4000/api/v1 |
| API docs | http://localhost:4000/api/docs |
| ML service | http://localhost:8000/docs |

## 9. Running each part manually

### Frontend

```bash
cd web
python3 -m http.server 5173
```

Open <http://localhost:5173>. The dashboard generates its dataset in the browser, so it
runs with no backend at all — useful when you want to work on the UI alone. See
`web/README.md` for how to point it at the live API.

### Database

```bash
cd server
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init
npx prisma generate
```

### Seed the synthetic data

```bash
cd server
npm install
npm run seed
```

This loads `data/synthetic_projects.csv`, creates ministries, agencies, demo users,
milestones, five quarterly returns per project, an initial prediction for every project and
the alerts those predictions trigger.

### Backend

```bash
cd server
npm run dev                     # http://localhost:4000
```

### ML service

```bash
cd ml-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.train             # trains and saves models/
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports whether the service is running on trained models or the calibrated
fallback, and whether SHAP is available.

## 10. Training the models

```bash
cd ml-service
python -m app.train --data ../data/synthetic_projects.csv --rows 3000
```

Two classifiers are trained: delay risk and cost-overrun risk. XGBoost is used when
installed, RandomForest otherwise, both wrapped in isotonic calibration. Artefacts and a
`training_report.json` land in `ml-service/models/`.

**On the metrics.** Labels are drawn stochastically from the feature-derived probability
rather than a hard threshold. A model fitted to a clean cut-off scores a near-perfect
ROC-AUC and returns near-binary probabilities — impressive on a slide, useless for a 0–100
score that has to rank projects against each other. The reported AUC of roughly 0.73–0.80
reflects genuine irreducible noise in the labels, and the probabilities it returns are
properly graded. If a judge asks why the AUC isn't 0.95, that is the answer.

## 11. Demo login

| Email | Role | Sees |
|---|---|---|
| admin@nirman.demo | Administrator | Everything, including settings and users |
| mospi@nirman.demo | MoSPI Officer | Full portfolio, alerts, interventions |
| ministry@morth.demo | Ministry Officer | MoRTH projects only |
| agency@nhai.demo | Agency Officer | NHAI projects; can file updates and upload CSV |
| analyst@nirman.demo | Analyst | Analytics and model insights |

Password for all demo accounts: `Demo@123`

## 12. Demonstration flow

1. Sign in as **mospi@nirman.demo**
2. Portfolio overview — KPIs, risk distribution, high-risk breakdowns by sector/ministry/state
3. Projects — filter to **Roads & Highways + Assam + High risk**
4. Open **NH Corridor Package-3** — delay risk, cost-overrun risk, overall score
5. Risk & explanation tab — the four project-specific drivers and the suggested review focus
6. Create an intervention and assign it to the agency
7. Alerts — acknowledge the high-risk alert
8. Data upload — import an updated CSV return
9. Watch the score and alert state refresh

The loop the UI is built to show: **Data → Prediction → Explanation → Officer Review →
Intervention → Updated Data**.

## 13. API documentation

Swagger UI is served at `/api/docs`. Base path `/api/v1`.

```
POST   /auth/login                 POST   /predictions/project/:id
POST   /auth/register              GET    /predictions/project/:id/latest
GET    /auth/me                    GET    /predictions/project/:id/history
POST   /auth/logout                POST   /predictions/batch
                                   POST   /predictions/refresh-all
GET    /projects
POST   /projects                   GET    /alerts
GET    /projects/:id               GET    /alerts/:id
PATCH  /projects/:id               PATCH  /alerts/:id/acknowledge
DELETE /projects/:id               PATCH  /alerts/:id/resolve
GET    /projects/:id/history       GET    /alerts/summary
POST   /projects/:id/updates
GET    /projects/:id/milestones    GET    /projects/:id/interventions
POST   /projects/:id/milestones    POST   /projects/:id/interventions
                                   PATCH  /interventions/:id
GET    /dashboard/summary
GET    /dashboard/risk-by-sector   POST   /uploads/projects/csv
GET    /dashboard/risk-by-ministry GET    /uploads/template
GET    /dashboard/risk-by-state    GET    /uploads/:id/status
GET    /dashboard/top-risk-projects
GET    /dashboard/risk-trends      GET    /admin/settings
```

## 14. Risk scoring

Engineered features:

```
cost_overrun_ratio      = (revised_cost - sanctioned_cost) / sanctioned_cost
progress_gap            = expected_progress_pct - physical_progress_pct
progress_vs_time_ratio  = physical_progress_pct / expected_progress_pct
schedule_slippage_ratio = elapsed_months / planned_duration_months
expenditure_ratio       = expenditure_incurred / revised_cost
milestone_delay_ratio   = delayed_milestones / total_milestones
land_gap                = (100 - land_acquisition_pct) / 100
clearance_penalty       = Approved 0 · Partial 0.5 · Pending 1.0
```

Overall score:

```
overall_risk_score = round(100 * (0.55 * delay_probability + 0.45 * cost_overrun_probability))

0–39 Low · 40–69 Medium · 70–84 High · 85–100 Critical
```

Thresholds and weights are configurable from Admin Settings and via `PATCH /admin/settings`.

One deliberate refinement over the base formula: schedule slippage is damped by physical
progress. A project at 95% complete that has run past its planned duration is a different
risk from one at 30% in the same position, and without the damping the portfolio fills with
false positives from nearly finished work.

## 15. Alert rules

| Rule | Alert |
|---|---|
| `overall_risk_score >= 70` | HIGH_RISK |
| `overall_risk_score >= 85` | CRITICAL_RISK |
| delay probability up 15+ points since last prediction | RISK_INCREASE |
| `expected_progress - physical_progress > 20` | PROGRESS_SLIPPAGE |
| `revised_cost > sanctioned_cost × 1.10` | COST_OVERRUN_RISK |
| `clearance_status = Pending` | CLEARANCE_PENDING |
| 2 or more milestones delayed | MILESTONE_DELAY |
| last update older than 30 days | STALE_DATA |

An alert of a given type is not duplicated while an earlier one is still open.

## 16. Security

Implemented: bcrypt password hashing (cost 12), JWT authentication, role-based
authorisation middleware, row-level scoping by ministry and agency, Zod input validation,
rate limiting (global and stricter on login), Helmet headers, CORS allow-list, environment
variables for all secrets, no password hash in any API response, and an audit log for
project edits, alert actions and intervention updates.

> This prototype uses synthetic data. Production deployment requires encryption, government
> SSO, security audit, authorised API access, and data-governance approval.

## 17. Synthetic-data disclosure

All 400 projects in `data/synthetic_projects.csv` are generated. Ministries, agencies,
contractors and project names are fictional. Risk labels are derived from project features,
not assigned at random, so the correlations a reviewer would expect — progress gap against
delay risk, cost revision against overrun risk — hold in the data.

Distribution: roughly 60% Low, 18% Medium, 22% High or Critical.

Three named scenarios are seeded for the demonstration:

| Project | Sector | State | Expected band |
|---|---|---|---|
| NH Corridor Package-3 | Roads & Highways | Assam | High (≈74–80) |
| Thermal Plant Unit-2 | Power | Odisha | Medium / upper Low (≈30–42) |
| Railway Electrification Phase-4 | Railways | Maharashtra | Low (≈15–23) |

## 18. Limitations

- Synthetic data only. No PAIMANA, OCMS or MoSPI data is used or claimed.
- The model is trained on generated data, so its accuracy figures describe that data and
  are not a claim about live project outcomes.
- Scores are risk indicators, not forecasts. No outcome is guaranteed.
- The browser dashboard and the trained ML service are two scoring paths over the same
  feature set and will differ by a few points on any given project. The API always uses the
  ML service, falling back to the calibrated local scorer only if the service is unreachable.
- Admin threshold changes are held in process memory in the API; a production build would
  persist them and version the change.
- No blockchain, payment, tender, procurement, satellite, drone or mobile-app features, by
  design.

## 19. Future scope

- Authorised PAIMANA/OCMS integration behind a data-sharing agreement
- Government SSO (NIC / Parichay) in place of local accounts
- Retraining on historical outcome data, with drift monitoring and model versioning
- Per-sector models, since the drivers of delay in Telecom differ from those in Railways
- Officer feedback captured on each prediction, closing the loop into the next training run
- Natural-language review notes generated from the driver set

---

© 2026 NIRMAN Prototype. Demo uses synthetic CUF-like project data. Production deployment
requires authorised PAIMANA/OCMS integration.
