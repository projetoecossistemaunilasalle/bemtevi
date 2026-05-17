# Privacy

Reserved for explicit privacy, LGPD, session, and analytics policy logic.

The current product direction is anonymous by default: no login, account, CPF, email, saved questionnaire answers, saved chat transcript, analytics provider, or location access.

Open decision: onboarding completion is currently persisted through a non-sensitive `localStorage` flag in `src/features/home/firstVisit.ts`. That behavior should be reviewed here before the app makes stronger claims about using only in-memory state.

Do not add persistence helpers, analytics, or location behavior here before privacy review.
