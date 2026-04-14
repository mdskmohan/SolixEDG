# Solix EDG Prototype — Setup Guide

## What this is

A front-end prototype for the **Solix Enterprise Data Governance (EDG)** platform, built with React + Vite. It runs entirely in the browser — no backend, no database, no login required.

Sections included in the prototype:
- **Home** — dashboard with metrics, activity feed, and quick actions
- **Data Catalog** — asset discovery, lineage, profiling, and certifications
- **Data Quality** — test runs, quality scores, and alerts
- **Glossary** — business term management
- **Classifications** — tag and sensitivity label management
- **Teams & Users** — team cards, member management, user roles
- **Access Control** — Roles → Policies → Rules (OpenMetadata model)
- **Personas** — UI layout customization per job role
- **Domains** — data domain and data product management
- **Policies** — compliance policy tracking (GDPR, CCPA, etc.)
- **Observability** — pipeline health and SLA monitoring
- **Workflows** — approval and certification workflow management
- **Audit Log** — activity and access audit trail

---

## Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Node.js | v18.x | v20.x or later |
| npm | v9.x | v10.x or later |
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Any modern OS |
| Browser | Chrome 110+, Edge 110+, Firefox 110+ | Chrome (latest) |

> **Check your Node version:**
> ```
> node --version
> ```
> If Node is not installed, download it from https://nodejs.org (choose the LTS version).

---

## Installation

### 1. Get the project folder

Copy the `Solix-EDG-Prototype` folder to your machine. If you received a zip file, extract it first.

### 2. Open a terminal in the project folder

**Windows:** Open the folder in File Explorer → right-click → "Open in Terminal" (or PowerShell)

**macOS / Linux:** Open Terminal and run:
```
cd path/to/Solix-EDG-Prototype
```

### 3. Install dependencies

```
npm install
```

This downloads React, Vite, and other packages into a `node_modules` folder. It takes about 30–60 seconds on first run.

### 4. Start the dev server

```
npm run dev
```

You should see output like:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 5. Open in browser

Go to **http://localhost:5173** in your browser.

---

## Stopping the server

Press `Ctrl + C` in the terminal window where the server is running.

---

## Sharing on your local network

If you want others on the same Wi-Fi / LAN to view it (e.g. during a demo):

```
npm run dev -- --host
```

They can then open the **Network** URL shown in the terminal (e.g. `http://192.168.1.42:5173`).

---

## Building a static version (optional)

To produce a self-contained build that can be hosted on any static file server:

```
npm run build
```

Output goes into the `dist/` folder. You can host `dist/` on Netlify, Vercel, S3, or any nginx/Apache server.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with permission errors | Run terminal as Administrator (Windows) or use `sudo npm install` (macOS/Linux) |
| Port 5173 already in use | Run `npm run dev -- --port 3000` to use a different port |
| Blank white screen in browser | Hard-refresh with `Ctrl + Shift + R` — the dev server may still be starting |
| "Cannot find module" error | Delete `node_modules` and run `npm install` again |
| Babel deoptimisation warning in terminal | Non-blocking — the file is large but the app works fine, ignore it |

---

## Project structure

```
Solix-EDG-Prototype/
├── solix-platform-v2.jsx   ← entire prototype (single file, ~8500 lines)
├── src/
│   └── main.jsx            ← entry point that mounts the app
├── index.html              ← HTML shell
├── vite.config.js          ← Vite configuration
├── package.json            ← dependencies and scripts
└── SETUP.md                ← this file
```

All product logic, components, mock data, and styling live in `solix-platform-v2.jsx`. No external CSS files, no routing library, no state management library.

---

## Contact

For questions about the prototype, reach out to the product team.
