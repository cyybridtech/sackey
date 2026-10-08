# POS System

Advanced custom Point of Sale system built for a clothing/underwear wholesale & retail business.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL (XAMPP locally / TiDB Cloud in production)
- **ORM**: Prisma

## Prerequisites
1. [Node.js](https://nodejs.org/) v18+
2. [XAMPP](https://www.apachefriends.org/) with MySQL running on port 3306

## Setup & Run

### 1. Start XAMPP MySQL
Open XAMPP Control Panel and start **MySQL**.

### 2. Create Database
Open phpMyAdmin at `http://localhost/phpmyadmin` and create a database named `pos_db`.

### 3. Install & Setup Backend
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Install & Run Frontend
```bash
cd client
npm install
npm run dev
```

### 5. Run Backend (in a separate terminal)
```bash
cd server
npm run dev
```

## Client checks

From the `client` directory, run `npm run lint` for ESLint checks and `npm run build` for the TypeScript check plus production bundle.

## Default Login Credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Worker A | `worker_a` | `worker123` |
| Worker B | `worker_b` | `worker123` |

> **Change all passwords after first login!**

## Ports
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Features
- Role-based access (Admin, Worker A, Worker B)
- Dual-confirmation sale workflow (Blue/Green/Red system)
- Customer CRM with debt tracking
- Credit/debt management with partial payments
- Flexible pricing with discount support
- Real-time notifications via Socket.io
- SMS queue with admin approval
- Audit logging for all actions
- Stock management with auto-deduction
- Flagged credit exposure when a credit sale has only one worker's confirmation

## Product Scope and Architecture

The implemented product is the single-business POS described in the requirements conversation. It is not the separate multi-seller marketplace concept: the current role model, sale confirmation workflow, and credit ledger are intentionally POS-specific.

The application is a modular monolith:
- React/Vite client for admin, sales-worker, and dispatch-worker workflows.
- Node.js/Express API with JWT authentication, role authorization, and Socket.IO.
- Prisma/MySQL as the relational source of truth.
- Sales, stock changes, credit-ledger entries, and outbound-SMS queue records must be committed as consistent database transactions.

Product size and colour are currently recorded as sale-line selections, while stock is tracked as one aggregate quantity per product. This does not provide variant-specific inventory counts; introduce SKU/variant stock records only if the business needs separate counts per size or colour.

### Credit flags and record maintenance

A first entry from either the Sales Desk or Dispatch immediately deducts its quantities from inventory in the same database transaction. An exact, unique match pairs the second entry without deducting stock again. Matching uses customer, issue type, product variant, and quantity; Dispatch does not enter prices or payment mode. Different entries remain separate and await their opposite-side record instead of being attached or flagged as a mismatch. Credit sales remain unposted debt until a matching Dispatch confirms them. Multiple possible matches are never paired arbitrarily.

Sales are soft-deleted: their items and worker snapshots remain available to admins, stock is restored when it had been deducted, and a clickable admin notification links to the retained record. A credit sale with recorded payments cannot be deleted until its balance is reconciled. The sale record stores whether its inventory deduction has already been applied. After changing the Prisma schema, update the database with `npm run db:push` from `server` and regenerate the Prisma client with `npm run db:generate`.

Admins can edit customer and user details, and can edit notes on sales. Only confirmed sales allow discount and sale-type changes; discount changes keep the ledger balance synchronized and cannot reduce the sale below payments already recorded. Customer deletion is allowed only before any sales, credit, or SMS history exists. Products are soft-deleted, users are deactivated, and financial records are not hard-deleted so the audit trail remains intact.

## Production Hardening Roadmap

1. **Reconcile finance and inventory.** Add a stock movement ledger and an auditable credit adjustment/void workflow (including payment reversals); never delete confirmed sale, debt, or payment history. Add reports that reconcile sales, payments, outstanding balances, and stock movements.
2. **Harden sale pairing and retries.** Add a shared sale/session reference to both workers' entries and idempotency keys for financial writes. Add integration tests for both entry orders, mismatches, duplicate submissions, ambiguous simultaneous sales, concurrent stock use, partial payments, and full settlement.
3. **Stabilize API contracts.** Keep frontend DTOs aligned with API JSON shapes, validate all request bodies and query parameters at the server boundary, remove `any` from sales/credit paths, and define explicit error/response types.
4. **Complete access controls.** Keep role and active-user checks server-side, protect socket connections with authenticated identity, add login throttling, and move production sessions from browser-persisted bearer tokens to secure HttpOnly cookies or a reviewed identity provider.
5. **Make operations observable and recoverable.** Add structured logs, request IDs, graceful shutdown, database readiness checks, idempotency keys for retryable financial writes, and auditable reconciliation for ledger/stock changes.
6. **Prepare deployment services.** Use managed MySQL/TiDB with TLS and backups. Local uploads are suitable only for development; production requires durable object storage. Vercel can host the static client and serverless HTTP handlers, but the current long-running Socket.IO server should move to a websocket-capable host or a managed realtime service. Set production `CLIENT_URL`, API URL, JWT secret, and database credentials through deployment secrets.
7. **Tune for production workload.** Add and verify indexes for common sales, customer-credit, audit, notification, and SMS-queue queries; apply schema changes through reviewed migrations and test restore/rollback procedures.

### First files to address

1. `server/src/controllers/sales.controller.ts`, `server/src/controllers/customers.controller.ts`, and `server/prisma/schema.prisma` — financial correctness and transactional invariants.
2. `client/src/types/index.ts` plus the relevant sales, customer, dashboard, and credit screens — API contract alignment.
3. `server/src/schemas/` and `server/src/routes/` — comprehensive boundary validation.
4. `server/src/middleware/auth.middleware.ts`, `server/src/services/socket.service.ts`, and `client/src/store/auth.store.ts` — production authentication and session lifecycle.
5. `server/src/index.ts`, `server/src/app.ts`, `server/src/services/`, and deployment configuration — operations and hosting-specific changes.
