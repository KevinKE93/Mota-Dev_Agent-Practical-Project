# Deployment

This project is a Vite static web app. Build output is written to `dist/`.

## Requirements

- Node.js 20 or newer
- npm

## Local Verification

```bash
npm install
npm run validate
npm run build
```

The `dev` branch also runs the same validation and build checks in GitHub Actions on push and pull request events.

Optional local preview:

```bash
npm run preview
```

## Static Hosting

Use these settings for Vercel, Netlify, Cloudflare Pages, or another static host:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## GitHub Pages

For GitHub Pages, build the app and publish the `dist/` directory with your preferred Pages workflow. The app does not require a backend service.

## Runtime Data

The game reads static JSON and image assets from `public/` at runtime. Keep `public/data/` and `public/assets/` in the deployed bundle.
