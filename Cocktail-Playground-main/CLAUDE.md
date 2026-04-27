# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A node-based cocktail specification builder for bar managers. Users can visually construct drink recipes, track the development of ideas, calculate Gross Profit (GP), and export specs to PDF/Excel.

## Tech Stack
- **Frontend:** React, React Flow (node-based UI), Tailwind CSS
- **Backend/Auth/DB:** Supabase (PostgreSQL, Row Level Security)
- **Hosting/Functions:** Vercel
- **Utilities:** `jspdf` (PDF export), `xlsx` (Excel export)

## Important Directories & Files
- `/src/components/nodes/` - Custom React Flow nodes (IngredientNode, ProcessNode, GlasswareNode).
- `/src/components/workspace/` - The main React Flow canvas and sidebar components.
- `/src/lib/supabase/` - Supabase client initialization and database helper functions.
- `/src/utils/calculations.js` - Pure functions for GP, cost, and margin calculations.
- `/src/utils/export.js` - Logic for mapping flow data to PDF and Excel layouts.
- `/api/` - Vercel Serverless Functions (if needed for heavy exports or webhooks).

## Commands
- `npm run dev` - Start local development server.
- `npm run build` - Build for production (Vercel standard).
- `npm run lint` - Run ESLint (formatting/linting enforced via pre-commit hooks).
- `npm run test` - Run unit tests (especially for `calculations.js`).

## Coding Standards & AI Guidelines

### React & React Flow
- Use functional components and hooks.
- For React Flow, keep node state synchronized with the application state (use Zustand or React Context for global state if passing props gets too deep).
- Custom nodes must remain visually compact but display critical data (Name, Volume, Cost).

### Supabase & Data
- Always respect Row Level Security (RLS). Ensure database queries use the authenticated user's session.
- Keep the schema normalized: `users` -> `specs` -> `nodes/ingredients`.
- Use Supabase Edge Functions only if a task is too heavy for the client (e.g., generating a massive PDF report).

### Business Logic (Gross Profit)
- Gross Profit (GP) formula: `((Sale Price - Cost) / Sale Price) * 100`.
- Always handle currency and volume conversions carefully (e.g., mL to oz, pence to pounds). Use standard utility functions in `calculations.js` to avoid floating-point math errors.

### Code Generation Rules
- Do not write formatting or linting fixes; hooks handle this.
- Focus on modularity: if a component exceeds ~150 lines, suggest abstracting it.
- When updating exports, ensure the visual graph data (nodes and edges) is flattened into a readable, sequential recipe table for the Excel/PDF output.
