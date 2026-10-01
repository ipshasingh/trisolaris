# Trisolaris — Full-Stack Three-Body Simulator

Trisolaris is a real-time 2D N-body gravity simulator inspired by Liu Cixin's *The Three-Body Problem*. This version migrates the original vanilla project to React + TypeScript with a Node/Express API and PostgreSQL persistence.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Simulation engine:** TypeScript + Canvas 2D
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Local infrastructure:** Docker Compose
- **Deployment target:** Render

There is **no authentication, registration, login, user table, or account system**. Saved experiments are anonymous records in the database.

## What is complete

### Simulator
- Three default suns + planet
- N-body Newtonian gravity
- Softened gravity
- Fourth-order Runge-Kutta (RK4) integration
- Adjustable `G`, softening and `dt`
- Trails
- Velocity vectors
- Gravity vectors and gravity ties
- Labels toggle
- Dark/light mode
- Play / pause / single-step / reset
- Simulation speed control
- Add Star / Planet / Moon / Body
- Remove added bodies
- Edit mass, position and velocity
- White stars, green planets, grey moons and brown generic bodies
- Per-planet climate, water, atmosphere and life diagnostics
- Stable / Chaotic Era classification

### Analysis
- Total system energy
- Energy drift diagnostic
- Maximum observed speed per body
- Close-encounter tracking
- Escape-condition detection
- Dominant gravitational pull breakdown
- Added-body influence tracking
- Numerical shadow-run chaos estimate / Lyapunov-style diagnostic
- No-additions counterfactual when the run has not been edited after the first addition
- Detailed Markdown report generated from the live simulation state
- Downloadable `.md` report

### Persistence
- Anonymous PostgreSQL save
- List saved experiments
- Load an experiment back into the simulator
- Delete saved experiments
- Server-side Zod validation
- Database bootstrap for the `simulations` table

## Project structure

```text
trisolaris/
├── client/
│   └── src/
│       ├── components/
│       │   ├── BodyEditor.tsx
│       │   ├── EnvironmentPanel.tsx
│       │   └── SimulationCanvas.tsx
│       ├── engine/
│       │   └── simulation.ts
│       └── lib/
│           └── api.ts
├── server/
│   └── src/
│       ├── db/
│       │   ├── index.ts
│       │   └── schema.ts
│       ├── routes/
│       │   └── simulations.ts
│       └── server.ts
├── shared/
│   └── src/index.ts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 3. Configure environment

Copy `.env.example` to `.env`.

### 4. Prepare the database

The server automatically creates the `simulations` table on startup. If you prefer Drizzle migrations, the project also includes:

```bash
npm run db:generate
npm run db:migrate
```

### 5. Start the application

```bash
npm run dev
```

Open `http://localhost:5173`.

The API health endpoint is `http://localhost:4000/api/health`.

### Production-like local run

```bash
npm run build
npm start
```

Then open `http://localhost:4000`.

## API

- `GET /api/health` — server health
- `GET /api/simulations` — list anonymous saved experiments
- `POST /api/simulations` — save a validated snapshot
- `GET /api/simulations/:id` — load a snapshot
- `DELETE /api/simulations/:id` — delete a snapshot

## Render deployment

Use one Render Web Service plus one Render PostgreSQL database.

1. Push this repository to GitHub.
2. Create a PostgreSQL database on Render.
3. Create a Render Web Service from the repository.
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Set `DATABASE_URL` to the Render PostgreSQL connection string.
7. Set `NODE_ENV=production`.
8. Deploy.

The Express server serves the compiled React app and the `/api/*` routes from the same origin.

## Deliberately not included

- Authentication
- Registration / login
- User profiles
- User accounts
- Chatbot / AI assistant
- 3D/WebGL renderer

Those can be added later if the project actually needs them, but they are not part of this simulator build.
