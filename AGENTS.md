# AGENTS.md - Refrielectricos E-Commerce Development Guidelines

## Project Overview

Refrielectricos is a full-stack e-commerce platform for refrigeration equipment and supplies. Built with NestJS (backend) and Next.js 14 (frontend), featuring a monorepo structure managed with pnpm workspaces.

**Tech Stack:**
- **Backend**: NestJS, Prisma ORM, PostgreSQL, JWT Authentication
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Zustand
- **Database**: PostgreSQL (External)
- **Cloud**: Cloudinary (image hosting)
- **Payments**: Wompi integration

---

## Build/Lint/Test Commands

### Backend (NestJS)
```bash
# Development
pnpm -C backend run start:dev    # Start with hot reload
pnpm -C backend run build        # Build for production
pnpm -C backend run start        # Start production server

# Testing
pnpm -C backend run test         # Run all unit tests
pnpm -C backend run test:watch   # Run tests in watch mode
pnpm -C backend run test:cov     # Run tests with coverage
pnpm -C backend run test:e2e     # Run end-to-end tests

# Quality
pnpm -C backend run lint         # Lint and auto-fix
pnpm -C backend run format       # Format with Prettier
```

### Frontend (Next.js)
```bash
# Development
pnpm -C frontend/refrielectricos run dev      # Start dev server
pnpm -C frontend/refrielectricos run build    # Build for production
pnpm -C frontend/refrielectricos run start    # Start production server

# Testing
pnpm -C frontend/refrielectricos run test         # Run unit tests
pnpm -C frontend/refrielectricos run test:watch   # Run tests in watch mode
pnpm -C frontend/refrielectricos run test:e2e     # Run E2E tests (Playwright)
```

### Monorepo Commands
```bash
# Install all dependencies
pnpm install

# Lint entire project
pnpm run lint

# Format entire project
pnpm run format
```

---

## Deployment (Vercel)

### Frontend Configuration
- **Root Directory**: `frontend/refrielectricos`
- **Build Command**: `bun run build`
- **Install Command**: `bun install`
- **Output Directory**: Next.js default (`.next`)

### Backend Configuration
- **Root Directory**: `backend`
- **Build Command**: `None` (Vercel handles NestJS via serverless functions or use a specific runtime)
- **Install Command**: `bun install`

---

## Environment Variables
- **Backend**: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION`, `CLOUDINARY_URL`, `BASE_URL_FRONTEND`, `BASE_URL_BACKEND`
- **Frontend**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

---

## Project Structure (Summary)
- `backend/`: NestJS API
- `frontend/refrielectricos/`: Next.js Frontend
- `packages/`: Shared packages (if any)
