# Production-Ready Next.js Architecture: Context + Zustand + React Query

> Optimized for a solo developer with full ownership, fast iteration, and a clear path to scale.

---

## High-Level Architecture

```
UI (Components / Pages)
        ↓
React Context  ──────────────────  Stable global values (auth identity, theme)
        ↓
Zustand  ────────────────────────  Ephemeral client/UI state (sidebar, filters)
        ↓
React Query  ────────────────────  Server state (fetching, caching, syncing)
        ↓
Service Layer  ──────────────────  API abstraction (axios/fetch wrappers)
        ↓
Backend
```

**Rule of thumb:**

| Layer | Owns |
|---|---|
| Context | *Who* the user is (identity, theme) |
| Zustand | *What* the user is doing (UI state) |
| React Query | *What* the backend says (server data) |

---

## Folder Structure (App Router)

```
src/
│
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
│       ├── page.tsx
│       └── loading.tsx
│
├── components/             # Reusable UI components
│   ├── ui/
│   ├── shared/
│   └── forms/
│
├── context/                # React Context — stable global state only
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── index.ts
│
├── store/                  # Zustand stores — client/UI state
│   ├── useUIStore.ts
│   ├── useAuthStore.ts     # Optional: if auth state needs more complexity
│   ├── useFilterStore.ts
│   └── index.ts
│
├── services/               # API layer — clean separation from components
│   ├── apiClient.ts        # Base fetch/axios wrapper
│   ├── authService.ts
│   ├── reportService.ts
│   └── userService.ts
│
├── hooks/                  # Custom hooks
│   ├── useAuth.ts
│   ├── useDebounce.ts
│   └── useMounted.ts
│
├── lib/                    # App-level config and setup
│   ├── queryClient.ts      # React Query — QueryClient instance
│   ├── utils.ts
│   └── constants.ts
│
├── providers/              # Centralized provider composition
│   └── AppProviders.tsx
│
├── styles/
│
└── types/                  # Shared TypeScript types
    ├── auth.ts
    ├── api.ts
    └── index.ts
```

---

## 1. Providers Setup

### `lib/queryClient.ts`

Define the `QueryClient` once, at the module level, and import it wherever needed.

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
```

---

### `providers/AppProviders.tsx`

```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/context/AuthContext";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

> **Note:** Define `queryClient` in a separate module (`lib/queryClient.ts`) so it is a stable singleton. Do **not** create it inline inside the component — it will be re-instantiated on every render.

---

### `app/layout.tsx`

```tsx
import AppProviders from "@/providers/AppProviders";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

---

## 2. React Context — Stable Global State Only

Use Context **only** for data that changes rarely and is needed app-wide (e.g., authenticated user identity, theme).

### `context/AuthContext.tsx`

```tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type User = { id: string; name: string } | null;

interface AuthContextType {
  user: User;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
```

> Keep Context providers **thin** — no heavy logic, no API calls. If auth state grows complex, move it to Zustand.

---

## 3. Zustand — Client / UI State

Use Zustand for ephemeral UI state that doesn't belong on the server and changes frequently.

### `store/useUIStore.ts`

```ts
import { create } from "zustand";

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

---

### `store/useFilterStore.ts`

```ts
import { create } from "zustand";

interface FilterStore {
  filters: Record<string, unknown>;
  setFilters: (filters: Record<string, unknown>) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: {},
  setFilters: (filters) => set({ filters }),
}));
```

---

## 4. Service Layer — API Abstraction

Always isolate API calls behind a service layer. Never call `fetch` directly from components or hooks.

### `services/apiClient.ts`

```ts
export const apiClient = async <T>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
};
```

> To pass auth tokens globally, add an `Authorization` header here (e.g., read from a cookie or token store).

---

### `services/reportService.ts`

```ts
import { apiClient } from "./apiClient";
import { Report } from "@/types/api";

export const getReports = (): Promise<Report[]> =>
  apiClient<Report[]>("/api/reports");
```

---

## 5. React Query — Server State

Use React Query for all data that originates from a server: fetching, caching, background refetching, and mutations.

### `hooks/useReports.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { getReports } from "@/services/reportService";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
  });
}
```

---

## 6. Real Usage — Dashboard Page

```tsx
import { useReports } from "@/hooks/useReports";
import { useUIStore } from "@/store/useUIStore";
import { useAuthContext } from "@/context/AuthContext";

export default function DashboardPage() {
  const { data: reports, isLoading } = useReports();   // Server state
  const { sidebarOpen, toggleSidebar } = useUIStore();  // UI state
  const { user } = useAuthContext();                    // Identity

  return (
    // ...
  );
}
```

Each concern has a single, predictable owner. No overlap.

---

## Common Mistakes to Avoid

| Mistake | Correct Approach |
|---|---|
| Storing API/server data in Zustand | Use React Query for all server state |
| Using Context for frequently changing state | Use Zustand for dynamic client state |
| Mixing all state logic in one file | Split by domain and concern |
| Calling `fetch` directly in components | Abstract all API calls into the service layer |
| Creating `QueryClient` inside a component | Define it once at module level in `lib/queryClient.ts` |

---

## Scaling Strategy

As the app grows, extend this architecture without restructuring:

- **Split Zustand stores by domain** — e.g., `useCartStore`, `useNotificationStore`
- **Add Zustand middleware** — `persist` for localStorage, `devtools` for debugging
- **Add React Query mutations** — `useMutation` for POST/PUT/DELETE operations
- **Centralize error handling** — add a global error boundary and API error interceptor in `apiClient.ts`
- **Introduce role-based logic** — guard routes and service calls using the auth context or store

---

## Final Mental Model

```
Context      →  Who the user IS        (identity, theme — rarely changes)
Zustand      →  What the user IS DOING (UI, filters — changes often)
React Query  →  What the backend SAYS  (server data — synced automatically)
```
