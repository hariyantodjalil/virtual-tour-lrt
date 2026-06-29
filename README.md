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

## Docker

Validate the Docker Compose files:

```bash
docker compose --env-file .env.dev.example -f docker-compose.dev.yml config
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Run the development stack locally:

```bash
docker build -t lrt-virtualtour:dev .
docker compose --env-file .env.dev.example -f docker-compose.dev.yml up -d
```

The dev stack publishes the app on port `5011` and Postgres on port `6010` by default. The prod stack is configured to publish only host port `80`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:deploy
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Notes

- Use local ignored environment files for runtime configuration.
- Do not commit real secrets.
- Keep application-specific contracts and deployment notes in this repository.
- GitLab CI/CD deploys `dev` from the `dev` branch and `prod` from the `main` branch.
- Runtime env files should live on the deployment host and be referenced by GitDev CI/CD variables.

## Repository

- GitDev: https://gitdev.kai.id/divisi-lrt/lrt-virtualtour
- Default branch: `main`
