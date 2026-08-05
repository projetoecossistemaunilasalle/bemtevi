# Front 07 — Home, Philosophy & Onboarding

## Goal

Create a stronger Home experience that explains BemTeVi’s philosophy, earns trust quickly, and guides the user without overwhelming them.

The client requested a better Home that explains the app’s philosophy. This may include a one-time onboarding flow similar to mobile apps.

---

## Home Responsibilities

Home should answer:

```txt
What is BemTeVi?
Can I trust it?
Is this anonymous?
What can I do here?
Where should I go next?
```

Home should not feel like a dashboard or a clinical form.

---

## Suggested Home Structure

1. Warm welcome.
2. Short philosophy statement.
3. Trust strip.
4. Three equal-weight entry paths.
5. Quiet link to learn more only if it points to a distinct, useful destination.

Do not add a regular “Como funciona” card or section to Home when the app-style starting screen exists. The starting screen is the explanation layer; repeating it on Home makes the first actionable screen heavier and should be treated as a regression.

---

## Philosophy Copy Direction

Example:

```txt
O BemTeVi é um espaço de apoio emocional para professores.

Aqui você pode entender melhor como está se sentindo, encontrar materiais confiáveis e descobrir caminhos de apoio — sem login, sem identificação e no seu ritmo.
```

---

## Trust Strip

Example:

```txt
Sem login
Sem identificação
Nada fica salvo sem sua permissão
```

Avoid absolute “nada fica salvo” wording. Current wording should explain that answers and conversations are not saved, while the browser keeps only the non-sensitive onboarding-seen preference.

```txt
Pensado para preservar sua privacidade
```

---

## One-Time Onboarding

A one-time onboarding is implemented as the app-style starting screen. Its completion state is stored only as the non-sensitive browser preference `bemtevi:onboarding-seen="true"`.

Possible onboarding screens:

1. **Um espaço para professores**
2. **Você escolhe o caminho**
3. **Não é diagnóstico**
4. **Privacidade em primeiro lugar**

Current product decision:

- Use the app-style starting screen as the onboarding explanation.
- Do not duplicate that explanation as a “Como funciona” section on Home.
- If users need to revisit onboarding later, add an explicit route or settings/help entry instead of placing the full explanation on Home.

---

## Entry Paths

The PRD asks for equal-weight choices. Avoid making one path visually urgent on Home.

Suggested cards:

```txt
Quero entender como estou
Quero conversar sobre o que estou sentindo
Quero encontrar apoio profissional
```

Immediate support remains available through the persistent Support tab.

---

## Acceptance Criteria

- Home clearly explains BemTeVi’s purpose.
- Home reinforces privacy and non-diagnostic positioning.
- Three primary paths have equal visual weight.
- Immediate support is accessible through persistent navigation.
- Home does not overuse alarming language.
- Home does not include a duplicate “Como funciona” section when onboarding is present.
- Onboarding copy discloses that the browser remembers only that the presentation was seen.
