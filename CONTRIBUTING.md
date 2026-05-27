# Contributing to ZenFlow

## Development Setup

1. Clone the repo
2. Run `.\setup.ps1` (Windows) or `bash setup.sh` (Linux/Mac)
3. Start dev: `pnpm dev`

## Project Structure

```
zenflow/
├── apps/web/          # Next.js 15 App Router
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/ # React components
│       ├── lib/       # Utilities
│       ├── server/    # tRPC routers
│       └── store/     # Zustand stores
├── packages/
│   ├── db/            # Prisma schema + client
│   ├── ui/            # Shared UI components
│   ├── auth/          # Auth.js config
│   ├── trpc/          # tRPC setup
│   └── config/        # Shared configs
└── docker-compose.yml
```

## Git Workflow

- Feature branches: `feat/module-name`
- Bug fixes: `fix/description`
- Commits follow Conventional Commits

## Code Style

- TypeScript strict mode
- Tailwind for styling
- Shadcn/UI components
- tRPC for API calls
- Zod for validation
