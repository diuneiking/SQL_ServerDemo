# SQL_ServerDemo

A production-derived Node.js/Express REST API backend built to power a multi-outlet F&B operations platform. This is a public demo extract from a live system currently running across 7 restaurant outlets.

---

## Overview

This server handles the full backend for a Flutter-based POS system — from order taking and payment processing through to shift management, inventory control, and real-time kitchen display sync.

Built and maintained solo as part of an internal operations platform, with no external agency or development team.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MySQL (via `mysql2` connection pool, 100 connections)
- **Real-time:** WebSocket (`ws`) for live POS terminal sync
- **Printer Bridge:** TCP server (`net`) bridging REST calls to ESC/POS receipt printers on port 9100
- **Environment:** dotenv for config management

---

## Key Features

### POS & Order Management
- Full order lifecycle: create, update, void, reverse, reprint
- Unpaid order queue with real-time WebSocket broadcast on state change
- Combo sets, modifiers, and add-ons support
- Discount and service charge configuration

### Multi-Outlet Architecture
- Routes prefixed `/`, `/2`, and `/1` serve independent outlet instances from a single server
- Per-outlet printer configuration, department routing, and sales tracking

### Shift & Day Management
- Clock in/out with timestamped attendance records
- End-of-shift and end-of-day workflows with sales reconciliation
- Payout tracking and shift-level sales summaries
- Unfinished day detection and recovery

### Inventory
- Real-time inventory deduction via MySQL stored procedure (`ProcessSaleItem`)
- Item management: create, update, portion sizing
- Stock broadcast to connected POS terminals on change

### Table & Zone Management
- Zone and table CRUD
- Table status updates, name changes, order reassignment across tables

### Staff & Auth
- Multi-role login (staff, admin)
- Team and user management
- Sales attribution by staff member

### Invoices & Reporting
- Invoice retrieval by order, by date, all-time
- Sales totals by date range and by staff
- Payout totals and history

### Kitchen Display
- Order receiver endpoints for kitchen screens
- Done/undone order state management
- Docket update support

### Printing
- `/print` endpoint routing print jobs via TCP to ESC/POS printers
- Per-outlet printer registry with department routing

---

## Scale

| Metric | Value |
|---|---|
| Total API routes | 194 |
| Lines of code | ~5,900 |
| Outlets served | 7 |
| DB connection pool | 100 concurrent connections |
| Deployment | Render (Node.js) |

---

## Project Structure

```
SQL_ServerDemo/
├── server.js       # Main Express app — all routes, WebSocket server, TCP bridge
├── db.js           # Database connection config
├── package.json
└── .env            # Environment variables (not committed)
```

---

## Environment Variables

```env
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
```

---

## Note

This is a demo extract. Sensitive credentials, internal business logic, and client-specific configurations have been removed. The full production codebase is maintained in a private repository.
