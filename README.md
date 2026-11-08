# Gardenia Smart Operations

A centralized inventory, sales, and warehouse management platform for Gardenia – serving 5 branches connected to one central warehouse.

## Features

- **Multi-role access control**: Admin, Salesperson, Branch Manager, Branch Storekeeper, Warehouse Manager, Management
- **Sales request workflow**: Create → Manager Approval → Storekeeper Issue → Inventory Deduction
- **Replenishment workflow**: Branch Request → Warehouse Approval → Dispatch → Branch Receipt
- **Real-time inventory tracking**: Separate balances per branch and central warehouse
- **Reports and analytics**: Filterable with CSV export
- **In-app notifications** for all workflow events
- **Low stock alerts** across all locations

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123). The home page redirects to the sign-in screen at `/g/login`.

## Demo Credentials

Passwords are **not** stored in source files. Set them via environment variables before first run:

```
GARDENIA_ADMIN_PASSWORD=<choose>   # EMP001 – System Administrator
GARDENIA_STAFF_PASSWORD=<choose>   # all other seeded accounts
```

When neither variable is set, seeded accounts are created with a random unknown password
and must be reset through the Admin → User Management page before they can sign in.

**Employee IDs:** EMP001 (admin), EMP002 (warehouse manager), EMP003 (management),
EMP101–EMP104 (branch 1), EMP201–EMP204 (branch 2), EMP301–EMP304 (branch 3),
EMP401–EMP404 (branch 4), EMP501–EMP504 (branch 5).

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Components**: shadcn/ui primitives
- **Storage**: Local JSON file (`data/gardenia.json`) – no external database required
- **Auth**: Session-based (scrypt password hashing, SHA-256 token hashing)

## Application Routes

| Path | Role | Description |
|------|------|-------------|
| `/g/login` | All | Sign-in page |
| `/g/admin` | Admin | Admin dashboard |
| `/g/admin/users` | Admin | User management |
| `/g/admin/products` | Admin | Product management |
| `/g/admin/branches` | Admin | Branch overview |
| `/g/salesperson` | Salesperson | Dashboard + request history |
| `/g/salesperson/new-request` | Salesperson | Create sales request |
| `/g/manager` | Branch Manager | Dashboard |
| `/g/manager/approvals` | Branch Manager | Approve/reject requests |
| `/g/manager/inventory` | Branch Manager | Branch stock levels |
| `/g/storekeeper` | Branch Storekeeper | Dashboard |
| `/g/storekeeper/issues` | Branch Storekeeper | Issue approved requests |
| `/g/storekeeper/inventory` | Branch Storekeeper | Branch stock levels |
| `/g/storekeeper/replenishment` | Branch Storekeeper | View + confirm replenishments |
| `/g/storekeeper/replenishment/new` | Branch Storekeeper | Request warehouse replenishment |
| `/g/warehouse` | Warehouse Manager | Dashboard |
| `/g/warehouse/inventory` | Warehouse Manager | Central warehouse inventory |
| `/g/warehouse/replenishment` | Warehouse Manager | Approve + dispatch replenishments |
| `/g/management` | Management | Executive overview |
| `/g/reports` | Admin/Management/Manager | Reports with CSV export |
| `/g/reports/history` | Multiple | Full transaction history |
| `/g/notifications` | All | In-app notifications |
| `/g/profile` | All | User profile |
