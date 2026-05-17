# Front 12 — Anonymous Analytics

## Goal

Define aggregate-only analytics that help improve the app without violating anonymity or trust.

This front should be designed early but implemented only after Privacy/LGPD approval.

See also: [`12b-anonymous-analytics-lgpd-policy.md`](./12b-anonymous-analytics-lgpd-policy.md).

---

## Allowed Event Types

Potentially allowed:

```txt
screen_view
resource_opened
flow_started
flow_completed
support_contact_clicked
education_filter_used
````

Only aggregate-level data should be collected.

---

## Blocked Data

Never collect:

```txt
questionnaire answers
chat transcript
individual path through the app
location
name
email
CPF
school
device identifiers
persistent user ID
advertising identifiers
```

---

## Event Shape

Example:

```ts
track('flow_completed', {
  flowId: 'srq20',
  resultBand: 'below_threshold'
});
```

Avoid:

```ts
track('answer_submitted', {
  questionId: 'q17',
  answer: true
});
```

---

## Analytics Provider

Acceptable provider constraints:

* cookieless;
* no advertising network;
* no individual tracking;
* IP anonymization;
* self-hosting preferred if possible.

---

## Acceptance Criteria

* Event taxonomy approved.
* Privacy copy updated.
* Analytics provider reviewed.
* No answer-level tracking.
* No individual session trajectory tracking.
