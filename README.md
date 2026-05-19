# SeCuida

SeCuida is a mobile-first React/Vite prototype for educator mental-health support in Portuguese. It offers a calm, anonymous-by-default experience for guided orientation, immediate support, educational resources, and local support contacts.

The app does not diagnose, does not replace professional care, and should not collect personal identification by default.

## Current Shape

- React 19, Vite, TypeScript, Tailwind CSS v4.
- React Router routes for `/`, `/orientacao`, `/apoio`, `/contatos`, `/educacao`, `/educacao/:resourceId`, and `/privacidade`.
- PWA manifest and GitHub Pages subpath support through `/SeCuida-Prototipo/`.
- Feature folders under `src/features`.
- Domain logic under `src/domain`.
- Structured content under `src/content`.
- Reusable UI primitives under `src/design-system`.
- Vitest coverage for content, first-visit onboarding behavior, flow engine, orientation UI, and questionnaire logic.

## Run Locally

Prerequisite: Node.js with pnpm.

```bash
pnpm install
pnpm run dev
```

The dev server defaults to port `3000`.

## Validation

```bash
pnpm run lint
pnpm run test
pnpm run build
```

`pnpm run lint` currently runs TypeScript with `tsc --noEmit`.

## Documentation

- Product requirements: [`docs/PRD.md`](docs/PRD.md)
- Project fronts and milestones: [`docs/fronts/README.md`](docs/fronts/README.md)
- Implementation plans: [`docs/plans/README.md`](docs/plans/README.md)
- Current repository context: [`docs/Project-Context.md`](docs/Project-Context.md)
- Analytics/LGPD policy note: [`docs/fronts/12b-anonymous-analytics-lgpd-policy.md`](docs/fronts/12b-anonymous-analytics-lgpd-policy.md)

## Current Caution

The app has no backend, login, analytics, saved questionnaire answers, saved chat transcript, or location access. The onboarding first-visit flag currently uses `localStorage`; this should be reviewed under the Privacy/LGPD front before the product makes strong persistence claims.
