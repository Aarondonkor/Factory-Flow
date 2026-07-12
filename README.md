# FactoryFlow

Management system for an LDPE blown film packaging factory (Ghana-based). Covers Production, Inventory, Sales/Orders, and HR with automated stock movements.

## Tech Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, Zustand, Recharts
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime)
- **Payments:** Paystack

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in order from `supabase/migrations/`
3. Copy your project URL and anon key

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PAYSTACK_PUBLIC_KEY
npm run dev
```

### 3. First admin user

After signing up, set your role in Supabase SQL editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## User Roles

| Role | Access |
|------|--------|
| admin | Full access |
| production_supervisor | Production + read-only inventory |
| sales_staff | Sales + read-only finished goods |
| hr_officer | HR only |
| staff | Attendance only |

## Currency & Dates

- Currency: GHS (Ghana Cedi)
- Date format: DD/MM/YYYY
