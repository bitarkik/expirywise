## Live Demo
https://expirywise.vercel.app

# ExpiryWise

ExpiryWise is a mobile-first retail inventory expiry tracker inspired by a real Dollar Tree receiving workflow. It helps store associates capture product details, enter expiry dates, and surface products that need markdown or removal checks before they expire.

## Why this project exists

Food expiry tracking in a store can become slow when the workflow depends on handwritten logs. This project explores a faster digital version: scan a receiving label when possible, save the expiry date manually for accuracy, and keep an always-visible action queue for items expiring within 14 days.

## Features

- Add products with SKU, name, category, location, quantity, received date, price, expiry date, and notes.
- Android-native label OCR bridge using Google ML Kit Text Recognition through Capacitor.
- Browser/PWA OCR fallback using Tesseract.js when native Android OCR is unavailable.
- Manual entry fallback when OCR output needs correction.
- Automatic status calculation for expired, due soon, in-date, and handled products.
- Markdown watchlist for products expiring within 14 days.
- Browser notification reminder support.
- Installable Progressive Web App support for Android home screen use.
- Offline app shell caching so the tracker can still open without network access.
- Search and filter by product, SKU, category, location, notes, or status.
- Local JSON import/export for inventory backups.
- Demo data for quick portfolio walkthroughs.

## Tech stack

- HTML
- CSS
- JavaScript
- Capacitor Android
- Google ML Kit Text Recognition
- LocalStorage for demo persistence
- Progressive Web App manifest and service worker
- Node.js static server

The web app still deploys as a static PWA, while the Android project adds a native scanner for better label OCR.

## Run locally

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:4173
```

On Android Chrome, use the browser install prompt or Add to Home screen to launch ExpiryWise like an app.

## Android scanner

EW 3.0 includes a Capacitor Android project with a native ML Kit OCR bridge.

Useful commands:

```bash
npm install
npm run build
npm run cap:sync
npm run android:open
```

Android builds require Android Studio with a JDK and Android SDK installed. The native scanner uses `ExpiryOcrPlugin` to return recognized label text to the existing Dollar Tree parser.

## Demo UPCs

These UPCs auto-fill sample product details:

- `639277543210`
- `874220145611`
- `051933210904`

## Project roadmap

- Build and test the native Android ML Kit scanner on a physical phone.
- Add IndexedDB storage for larger personal inventory data.
- Add a backend database with user accounts and store locations.
- Add scheduled email or push notifications.
- Add role-based views for associates and managers.
- Add CSV export for store reporting.
- Add audit history for markdown, removal, and donation actions.

## Resume bullet

Built an offline-first retail expiry tracker with a Capacitor Android shell, native ML Kit label OCR, local inventory persistence, and an action queue for products expiring within 14 days.
