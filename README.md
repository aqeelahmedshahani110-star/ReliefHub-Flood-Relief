# ReliefHub: Flood Relief Coordination Dashboard (Sindh Response)

**ReliefHub** is a web coordination dashboard designed for disaster relief agencies during flood response operations in Sindh, Pakistan. It provides a shared operational view to prevent duplicate deliveries, prioritize underserved camps lacking food, clean water, or medicines, manage warehouse inventory, authorize supplies dispatches, and deploy volunteers.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js (v18+ recommended, built with zero external dependencies)

### 2. Start the Server
```bash
node server.js
```
The server runs on port **3000** and serves both the REST API and the frontend dashboard.

Open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

### 3. Run Automated Tests
```bash
node test-suite.js
```
All 9 milestone verification tests run and validate rules including stock reservation, over-allocation prevention, and auto-full status.

---

## 🧩 Milestones & Features Implemented

### 🛡️ Role Support (Admin & Field Volunteer)
- **Relief Coordinator (Admin)**: Full control over camp registry, inventory, dispatch authorizations, and volunteer deployments.
- **Field Volunteer**: Field-focused view for demand reporting and self-assignment, with destructive actions disabled.
- Switch roles dynamically anytime via the top header toggle.

### ⛺ Milestone 1 — Camp Management
- Full CRUD for camps: `name`, `district`, `capacity`, `current_families`, `status`.
- Real-time search by camp name or district.
- Filter by status (`Active`, `Full`, `Closed`).
- **Automated Occupancy Rule**: Camps are automatically flagged as **`Full`** whenever `current_families >= capacity`. If families fall below capacity, status returns to `Active`.

### 📦 Milestone 2 — Camp Needs & Warehouse
- **Camp Needs CRUD**: Add, edit, remove needs linked to warehouse items.
- Configurable priority (`High`, `Medium`, `Low`).
- **Live Fulfilment Progress**: Visual progress bar calculated as `fulfilled_quantity ÷ required_quantity`.
- **Warehouse Inventory CRUD**: Item name, category, unit, stock count, and reorder level.
- **Low Stock Highlights**: Items with `stock <= reorder_level` are highlighted with an urgent warning badge.

### 🚚 Milestone 3 — Dispatches & Stock Reservations
- Direct supply dispatch creation linking camps and needs.
- **Immediate Stock Reservation**: Warehouse stock is deducted immediately upon dispatch creation to prevent duplicate allocation.
- **Strict Anti-Overdispatch Rules**:
  1. `Never dispatch more than available stock` — validated in real-time.
  2. `Never exceed a need's remaining unreserved quantity`: `required - fulfilled - other active dispatches`.
- **Status Lifecycle**: `Pending` ➔ `In Transit` ➔ `Delivered` (or `Cancelled`).
- **Delivered Transition**: Increases `fulfilled_quantity` on the camp need.
- **Cancellation**: Cancelling an undelivered dispatch automatically restores stock back to warehouse inventory.

### 🤝 Milestone 4 — Donations & Volunteers
- **Donation Management**:
  - Record **Cash** and **In-Kind** contributions.
  - In-Kind donations automatically replenish warehouse stock immediately.
  - Financial summary showing total cash received and breakdowns by category (Food, Medicine, Shelter, Water, Other).
- **Volunteer Registry & Deployment**:
  - Filter and search by skills: `Medical`, `Logistics`, `Cooking`, `Driving`, `Counselling`.
  - Assign / unassign volunteers to camps.
  - Enforces single active deployment per volunteer.
  - **Closed Camp Rule**: Volunteers cannot be assigned to `Closed` camps.

### 📊 Milestone 5 — Dashboard & Critical Gaps
- **5 Core KPI Cards**:
  1. Active Camps
  2. Families Sheltered
  3. Overall Fulfilment Percentage
  4. Low Stock Items Count
  5. Volunteers Deployed
- **Interactive Category Chart**: Visual bar chart of need fulfilment percentage broken down by relief category.
- **Critical Gaps Table**:
  - Isolates High-priority needs with `< 40%` fulfilment.
  - Ordered by worst gap (ascending fulfilment percentage).
  - Quick action drill-downs: **⚡ Quick Dispatch** (pre-fills dispatch modal) and **⛺ View Camp**.

### 🗃️ Milestone 6 — Mock API & Seed Data
- HTTP REST API with full persistence to `db.json`.
- Seed data meeting all hackathon specifications:
  - **8 Camps** across 7 Sindh districts (Dadu, Sukkur, Larkana, Jamshoro, Hyderabad, Shikarpur, Thatta), including 1 `Full` camp and 1 `Closed` camp.
  - **12 Inventory Items** (including 3 Low Stock items).
  - **20 Needs** (including 4 Critical Gaps).
  - **10 Dispatches** across Pending, In Transit, Delivered, and Cancelled states.
  - **10 Donations** (Cash & In-Kind across categories).
  - **15 Volunteers** across all 5 skills.
- **Seed Reset**: Use the `🔄 Reset Seed` button in the header or `POST /api/reset` to restore pristine seed state anytime.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/camps` | List all relief camps |
| `POST` | `/api/camps` | Create camp (auto-marks Full if capacity reached) |
| `PUT` | `/api/camps/:id` | Update camp details |
| `DELETE` | `/api/camps/:id` | Delete camp (cleans up associated needs & unassigns volunteers) |
| `GET` | `/api/inventory` | List warehouse inventory items |
| `POST` | `/api/inventory` | Add inventory item |
| `PUT` | `/api/inventory/:id` | Update inventory item |
| `DELETE` | `/api/inventory/:id` | Remove inventory item |
| `GET` | `/api/needs` | List camp needs |
| `POST` | `/api/needs` | Add supply need for a camp |
| `PUT` | `/api/needs/:id` | Update need |
| `DELETE` | `/api/needs/:id` | Remove need |
| `GET` | `/api/dispatches` | List dispatches |
| `POST` | `/api/dispatches` | Create dispatch (validates & reserves stock) |
| `PUT` | `/api/dispatches/:id` | Update status (Delivered increases need fulfilment, Cancelled restores stock) |
| `GET` | `/api/donations` | List donations |
| `POST` | `/api/donations` | Record donation (In-Kind increases item stock) |
| `GET` | `/api/volunteers` | List volunteers |
| `POST` | `/api/volunteers` | Register volunteer |
| `PUT` | `/api/volunteers/:id` | Assign/unassign volunteer (prevents Closed camp assignment) |
| `POST` | `/api/reset` | Restore pristine seed dataset |

