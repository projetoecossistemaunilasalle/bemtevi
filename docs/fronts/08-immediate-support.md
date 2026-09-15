# Front 08 — Immediate Support Screen

## Goal

Provide a calm, always-accessible support destination for users who may need immediate help.

Avoid emotionally loaded naming where possible. Prefer “Apoio” or “Apoio agora” over “Crise” in routes and visible navigation, subject to copy/design review.

---

## Route

Recommended route:

```txt
/apoio
```

Avoid:

```txt
/crise
```

The goal is to avoid reinforcing a distressing word while still giving users a clear support path.

---

## Content

The screen should include:

- grounding message;
- CVV 188;
- SAMU 192;
- Bombeiros 193;
- breathing exercise;
- calm explanation;
- direct call buttons.

---

## Breathing Exercise

The breathing card is not decorative. It is a first-care tool.

Example:

```txt
Respire comigo por um momento

Inspire por 4 segundos.
Segure por 2 segundos.
Expire por 6 segundos.

Repita algumas vezes antes de decidir o próximo passo.
```

---

## System Destination

The screen is both:

1. a user-accessible route;
2. a safety destination from flow rules.

Examples:

```txt
bottom nav → /apoio
Q17 affirmative → /apoio
global action “Quero apoio agora” → /apoio
```

---

## Design Rules

- No red-first visual language.
- No alarmist animation.
- No shame-based language.
- Use calm green/blue surfaces.
- Phone numbers should be large and tappable.
- The breathing exercise should have equal dignity with phone cards.

---

## Acceptance Criteria

- Support route exists at `/apoio` or another calm approved route.
- Persistent nav can reach it from anywhere.
- CVV/SAMU/Bombeiros cards are present.
- Breathing exercise is present.
- Flow safety rules can route here.
- Screen avoids alarmist treatment.
