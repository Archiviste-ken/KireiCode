# Code Intelligence Engine

Production-grade TypeScript architecture for a static-analysis backend with a Next.js App Router surface.

## Architecture

- `app/`: UI and API route handlers (thin transport layer)
- `core/`: Pure analysis domain logic (parser -> IR -> graph -> rules -> analyzers -> pipeline)
- `modules/`: External integrations (repo IO, AI providers, DB adapters)
- `types/`: Shared request/response contracts
- `utils/`: Cross-cutting utilities and constants

## Dependency Direction (No Circular Dependencies)

- `app` -> `core`, `modules`, `types`, `utils`
- `modules` -> `core` (types only), `utils`
- `core` -> `utils`
- `types` -> `core` (types only)
- `utils` -> (no internal dependencies)

Never import `app` from any other folder.

## Key Entry Points

- Analysis API: `app/api/analyze/route.ts`
- Chat API: `app/api/chat/route.ts`
- Analysis Brain: `core/pipeline/analyzeRepo.ts`

## Development

```bash
npm run dev
```

```bash
npm run lint
```

```bash
npm run build
```
