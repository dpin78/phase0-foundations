# Phase 0 – Foundations (Supabase + MQTT + API)

This repo contains the lean, scalable foundations:
- **migrations/**: Supabase schema + RLS + partitions
- **worker/**: MQTT ingest → Supabase
- **api/**: Minimal owner-scoped API
- **docs/**: ERD and architectural notes
- **.github/**: CI/CD workflows

## Quick Start
1) Create a Supabase project. Run `migrations/001_init.sql`.
2) Copy `.env.example` to `.env` in both **worker/** and **api/** and fill values.
3) `cd worker && pnpm i` (or `npm i`) then `pnpm dev` (or `npm run dev`).
4) `cd api && pnpm i` then `pnpm dev`.
5) Publish a test MQTT message to `/dev/{owner}/{location}/{device}/evt` and verify inserts.

## Structure
See folders for details. Update CI/CD later as you choose Fly.io/Render/Vercel.