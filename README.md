## 🚀 Live Demo
https://expirywise.vercel.app

# ExpiryWise

ExpiryWise is a mobile-first retail inventory expiry tracker inspired by a real Dollar Tree receiving workflow. It helps store associates capture product details, enter expiry dates, and surface products that need markdown or removal checks before they expire.

## Why this project exists

Food expiry tracking in a store can become slow when the workflow depends on handwritten logs. This project explores a faster digital version: scan a product UPC when possible, save the expiry date manually for accuracy, and keep an always-visible action queue for items expiring within 14 days.

## Features

- Add products with UPC/SKU, name, category, location, quantity, expiry date, and notes.
- Browser-based barcode scanning using the experimental `BarcodeDetector` API when supported.
- Manual entry fallback for browsers or devices without barcode support.
- Automatic status calculation for expired, due soon, in-date, and handled products.
- Markdown watchlist for products expiring within 14 days.
- Browser notification reminder support.
- Search and filter by product, UPC, category, location, notes, or status.
- Local JSON import/export for inventory backups.
- Demo data for quick portfolio walkthroughs.

## Tech stack

- HTML
- CSS
- JavaScript
- LocalStorage for demo persistence
- Node.js static server

This version intentionally avoids external dependencies so the project is easy to run, review, and deploy as a portfolio demo.

## Run locally

```bash
node server.js
```

Then open:

```text
http://localhost:4173
```

## Demo UPCs

These UPCs auto-fill sample product details:

- `639277543210`
- `874220145611`
- `051933210904`

## Project roadmap

- Add OCR extraction for product labels using a service such as Google Vision API or Tesseract.
- Add a backend database with user accounts and store locations.
- Add scheduled email or push notifications.
- Add role-based views for associates and managers.
- Add CSV export for store reporting.
- Add audit history for markdown, removal, and donation actions.

## Resume bullet

Built a mobile-first retail expiry tracker that scans UPC labels, stores manually verified expiry dates, and automatically surfaces markdown reminders for products expiring within 14 days.
