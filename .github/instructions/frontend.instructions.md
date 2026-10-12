---
applyTo: "apps/web/**/*.ts,apps/web/**/*.tsx"
---

# Frontend Instructions

## Next.js App Router conventions

- All routes live under `apps/web/src/app/`
- Route groups: `(auth)` for login/logout, `(dashboard)` for protected pages
- Layouts: `layout.tsx` at each route group level; root layout sets fonts and providers
- Loading states: `loading.tsx` per route segment (skeleton UI)
- Error states: `error.tsx` per route segment
- Server Components by default; add `'use client'` only when needed (interactivity, hooks, browser APIs)
- Never fetch data directly from a Server Component using Prisma — always call the API

## Component structure

```
apps/web/src/
  app/                  Routes (App Router)
  components/
    ui/                 shadcn/ui primitives (do not edit generated files)
    layout/             Sidebar, TopNav, Breadcrumbs
    shared/             DataTable, PageHeader, StatusBadge, ConfirmDialog, etc.
    [feature]/          Feature-specific components
  hooks/                Custom React hooks (useAuth, usePagination, etc.)
  lib/
    api/                Typed API client (axios instance + per-resource functions)
    utils.ts            cn(), formatCurrency(), formatDate(), etc.
    validations/        Zod schemas for forms
  providers/            QueryClientProvider, AuthProvider, ThemeProvider
  types/                Frontend-specific TypeScript types
```

## Forms

- Use React Hook Form + Zod resolver for all forms
- Define Zod schema in `lib/validations/`; infer the TypeScript type from it
- Show inline field errors below each input
- Disable submit button while mutation is pending
- Show toast on success and on error

## API integration

- All API calls go through `lib/api/` — never call `fetch` directly in a component
- Use TanStack Query `useQuery` for reads, `useMutation` for writes
- Always handle `isLoading`, `isError`, and empty states
- On 401 responses, redirect to `/login`
- On 403 responses, show a "Not authorized" message — do not redirect

## Loading and error states

- Use skeleton components (from shadcn/ui `Skeleton`) during data loading
- Show a meaningful error message with a retry button on query failure
- Show a useful empty state (icon + message + CTA) when a list is empty

## Accessibility

- All form inputs must have associated `<label>` elements
- Interactive elements must be keyboard-navigable
- Use semantic HTML (`<main>`, `<nav>`, `<section>`, `<table>`)
- Maintain WCAG AA color contrast

## Currency and date formatting

```ts
// Currency — always INR
formatCurrency(amount: number | string): string
// Uses Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

// Date — display in IST
formatDate(iso: string): string        // e.g. "12 Jul 2025"
formatDateTime(iso: string): string    // e.g. "12 Jul 2025, 14:30 IST"
```

## Role-aware navigation

- Read the current user's role from the auth context
- Conditionally render navigation items based on role
- Always enforce the same permissions on the backend — hiding a nav item is not security

## Component rules

- Do not build monolithic page components; split into focused sub-components
- Reuse `DataTable`, `PageHeader`, `StatusBadge`, `ConfirmDialog` across features
- Do not duplicate API call logic; put it in a custom hook or `lib/api/`
- Do not hardcode statistics or counts — always derive from API responses
