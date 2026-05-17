# Anonymous Analytics LGPD Policy Note

## Status

Decision note for the Privacy/LGPD and Anonymous Analytics fronts.

This is **not** an implementation plan for the current app. SeCuida does not currently have a backend, analytics provider, event collector, or reporting store. No analytics work should start until the Privacy/LGPD policy is approved and a backend/storage design exists.

---

## Product Position

SeCuida may collect product analytics only as aggregate, non-identifying metrics.

The purpose of analytics should be to understand whether the product is useful and where users need support, not to understand or reconstruct the behavior of an individual educator.

Analytics must never turn the app into a monitoring surface for teachers, schools, or mental-health status.

---

## Allowed Analytics

Allowed analytics should be stored as aggregate counters only.

Examples:

| Metric | Allowed shape |
|---|---|
| Page views | Count visits per route per day |
| Resource engagement | Count clicks/openings per resource ID |
| Support engagement | Count support contact clicks by contact ID |
| Flow starts | Count starts per guided-flow ID |
| Flow completions | Count completions per guided-flow ID |
| Questionnaire result bands | Count broad result bands only, with small-count suppression |
| Device category | Coarse category such as mobile, tablet, desktop |

Allowed records should look like:

```txt
date        event       route    device   count
2026-05-16  page_view   /apoio   mobile   14
```

They should not look like raw per-user event logs.

---

## Prohibited Analytics

Do not collect:

- school name;
- teacher name;
- email;
- CPF;
- phone number;
- teacher registration or institutional ID;
- exact location;
- GPS coordinates;
- IP address in stored analytics records;
- user agent in stored analytics records;
- persistent user ID;
- session ID;
- advertising ID;
- device fingerprint;
- exact questionnaire answers;
- SRQ-20 answer sequence;
- guided-chat transcript;
- full user path through the app;
- per-user return behavior;
- school-level mental-health result aggregation.

School data is specifically out of scope. Even without a teacher name, school plus sensitive usage patterns could create a realistic re-identification or workplace-monitoring risk.

---

## Sensitive Events

Some events are more sensitive even when aggregated:

- immediate support page views;
- support contact clicks;
- SRQ-20 starts;
- SRQ-20 completions;
- SRQ-20 result bands;
- guided-flow result outcomes.

For these, apply additional safeguards:

- aggregate by day or broader period;
- do not store raw timestamps;
- suppress reporting for small counts;
- avoid school, city-neighborhood, or other small-group dimensions;
- avoid joining sensitive events with device category if it creates tiny groups.

Suggested minimum reporting threshold:

```txt
Do not display or export sensitive metric rows where count < 10.
```

---

## Google Analytics Position

Google Analytics should be treated as **not approved** for SeCuida by default.

Reasons:

- SeCuida handles mental-health-adjacent behavior, which deserves stricter minimization.
- Google Analytics is built around event collection and reporting, not aggregate-only counter storage.
- Even when configured with privacy controls, it can create governance complexity around IP handling, cookies, device/browser signals, retention, cross-service processing, and international transfer.
- It is harder to prove that no individual journey, identifier, or sensitive route sequence is being retained.

Using Google Analytics would require a separate legal/privacy review, documented configuration, consent/disclosure analysis, data processing terms, retention settings, and proof that sensitive data and user-level tracking are not collected.

For the MVP, do not use Google Analytics.

Preferred direction: a first-party aggregate counter endpoint controlled by SeCuida, with no cookies, no persistent identifiers, no raw event retention, and no third-party advertising or behavioral analytics provider.

---

## Future Implementation Boundary

If analytics becomes approved later, start with a no-op frontend boundary and a first-party backend collector.

Recommended frontend shape:

```txt
src/lib/analytics/types.ts
src/lib/analytics/noopAnalytics.ts
src/lib/analytics/analyticsClient.ts
src/domain/analytics/policy.ts
```

Recommended backend behavior:

1. Accept a limited allowlist of event names.
2. Validate route/resource/flow IDs against known registries.
3. Derive only coarse device category if needed.
4. Increment aggregate counters.
5. Discard raw request details.
6. Do not store IP address.
7. Do not store user agent.
8. Do not issue cookies.
9. Do not create user or session identifiers.
10. Suppress small sensitive counts in reporting.

---

## Client-Safe Reporting

Safe reports to offer:

- most viewed pages;
- most opened educational resources;
- total support page opens;
- total support contact clicks by contact type;
- flow starts and completions by flow ID;
- broad device category share;
- broad questionnaire result-band totals only when counts are high enough.

Reports to refuse:

- school-level usage;
- teacher-level usage;
- individual journeys;
- answer-level analytics;
- transcript review;
- location-based distress patterns;
- small-group mental-health result comparisons.

---

## Copy Guidance

If analytics is implemented later, user-facing copy should say plainly:

```txt
O SeCuida coleta apenas métricas agregadas de uso, como páginas acessadas e recursos abertos, para melhorar o produto. Não usamos cookies de rastreamento, não identificamos pessoas, não salvamos respostas individuais, histórico de conversa, escola, localização precisa ou dados de saúde associados a uma pessoa.
```

Do not claim analytics is anonymous unless the implementation stores only aggregate counters and there is no reasonable way to re-identify a person from the collected records.
