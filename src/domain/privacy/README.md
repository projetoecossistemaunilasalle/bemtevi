# Privacy

Reserved for explicit privacy, LGPD, session, and analytics policy logic.

The current product direction avoids requesting personal identification: no login, account, CPF, email, saved questionnaire answers, saved scores, saved chat transcript, or analytics provider. The contacts screen requests location only after an explicit user action and uses a rounded coordinate in memory to choose a nearby city; it is never stored or transmitted.

The only product-level persistence is the non-sensitive onboarding completion flag in `src/features/home/firstVisit.ts`. It uses `localStorage` key `bemtevi:onboarding-seen` with value `"true"` and contains no health or personal-identification data.

Do not add persistence helpers, analytics, or new location behavior here before privacy review.
