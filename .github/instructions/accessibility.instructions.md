---
description: 'Accessibility guidance for WCAG 2.2 Level AA conformance'
applyTo: '**/*.html,**/*.css,**/*.js'
---

# Accessibility Instructions

Conform to WCAG 2.2 Level AA. Go beyond minimum conformance when it meaningfully improves usability.

## Non-negotiables

- Prefer native HTML elements/attributes over ARIA
- Use ARIA only when necessary (don't add ARIA when native semantics already work)
- Ensure correct accessible name, role, value, states, and properties
- All interactive elements are keyboard operable, with clearly visible focus, and no keyboard traps
- Do not claim the output is "fully accessible"

## Page Structure

- Use landmarks: `header`, `nav`, `main`, `footer`
- Use headings to introduce sections; avoid skipping heading levels
- Use exactly one `h1` for the page topic
- Set a descriptive `<title>` (prefer "Page - Section - Site")

## Keyboard and Focus

- All interactive elements are keyboard operable
- Tab order follows reading order and is predictable
- Focus is always visible
- Hidden content is not focusable (`hidden`, `display:none`, `visibility:hidden`)
- Static content must not be tabbable
- Focus must not be trapped

## Skip Link

Provide a skip link as the first focusable element:

```html
<a href="#maincontent" class="sr-only">Skip to main content</a>
<main id="maincontent" tabindex="-1">...</main>
```

## Forms

- Every input has an associated visible `<label>` (use `for`/`id` or wrapping)
- Group related inputs with `<fieldset>` and `<legend>`
- Provide accessible error messages linked to inputs via `aria-describedby`
- Use `aria-required="true"` for required fields
- Don't rely on color alone to indicate errors

## Images and Media

- All `<img>` elements have meaningful `alt` text (or `alt=""` for decorative images)
- Use `<figure>` and `<figcaption>` for images that need captions

## Color and Contrast

- Text contrast ratio: minimum 4.5:1 (normal text), 3:1 (large text)
- Don't rely on color alone to convey information
- Ensure focus indicators are visible against all backgrounds

## Dynamic Content

- Use `aria-live` regions for dynamic updates (polite for non-urgent, assertive for urgent)
- Manage focus when content changes (modals, in-page navigation)
- Ensure loading states are announced to screen readers

## Language

- Use respectful, inclusive, people-first language in UI text
- Set `lang` attribute on `<html>` element
