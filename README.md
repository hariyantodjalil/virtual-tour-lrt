# lrt-virtualtour

Virtual tour application for the Divisi LRT platform.

## Overview

This repository contains the LRT virtual tour frontend and CMS. The app is built with Next.js and includes virtual tour editing, station and commercial-space CMS flows, analytics, lead capture, and Prisma-backed data access.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Notes

- Use local ignored environment files for runtime configuration.
- Do not commit real secrets.
- Keep application-specific contracts and deployment notes in this repository.

## Repository

- GitDev: https://gitdev.kai.id/divisi-lrt/lrt-virtualtour
- Default branch: `main`
