# PWA Offline Support — Design

Date: 2026-05-19
Front: 01 — App Architecture & PWA

## Problem

The app has a PWA manifest but no service worker. It cannot be installed as a PWA or work offline. All content is bundled client-side (no API calls), making it an ideal candidate for full offline support.

## Decision

Use `vite-plugin-pwa` with precache strategy. All built assets (JS, CSS, HTML, icons, manifest) are precached at service worker install. The app works fully offline after first visit.

## Architecture

```
vite.config.ts
  └─ VitePWA plugin
       ├─ registerType: 'autoUpdate'
       ├─ workbox.globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']
       ├─ manifest: merged from existing manifest.webmanifest
       └─ devOptions: { enabled: true }
```

## Changes

1. Install `vite-plugin-pwa` as devDependency
2. Configure in `vite.config.ts` with precache + manifest config
3. Delete `public/manifest.webmanifest` (plugin generates it)
4. Generate 192x192 and 512x512 PNG icons from existing SVG
5. Add Apple meta tags to `index.html` (apple-mobile-web-app-capable, apple-touch-icon)
6. Remove manual `<link rel="manifest">` from `index.html` (plugin injects it)

## Offline behavior

- First visit: SW installs and precaches all assets
- Subsequent visits: fully offline — all routes, questionnaires, breathing exercises, contacts
- SPA routing offline: `navigateFallback: 'index.html'` ensures all routes resolve to app shell

## Analytics compatibility

Precache approach does not interfere with future anonymous analytics (Front 12). Analytics can use queue-and-flush pattern: store events in memory/IndexedDB, send when online. No SW changes needed.

## Files modified

- `vite.config.ts` — add VitePWA plugin config
- `index.html` — add Apple meta tags, remove manual manifest link
- `public/manifest.webmanifest` — delete (replaced by plugin-generated)
- `public/icon-192.png` — new (generated from SVG)
- `public/icon-512.png` — new (generated from SVG)
- `public/apple-touch-icon.png` — new (generated from SVG)
