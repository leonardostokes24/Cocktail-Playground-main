<div align="center">

# 🍸 Cocktail Spec Builder

**A visual, node-based recipe and specification builder designed for modern bar managers.**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](#)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](#)

</div>

---

## 📖 Project Overview

The **Cocktail Spec Builder** revolutionizes how bar managers design and document their drink menus. By leveraging a visual, node-based canvas, users can intuitively construct drink recipes, track the development of flavor profiles, calculate Gross Profit (GP) in real-time, and seamlessly export finalized specs to PDF or Excel.

## 🚀 Tech Stack

* **Frontend:** React, React Flow (Node-based UI), Tailwind CSS
* **Backend & DB:** Supabase (PostgreSQL, Authenticated Row Level Security)
* **Hosting & APIs:** Vercel (Serverless Functions)
* **Utilities:** `jspdf` (PDF generation), `xlsx` (Excel exports), Zustand/Context (State Management)

---

## 📁 Project Structure

A quick overview of the essential directories to help you navigate the codebase:

```text
├── /api/                       # Vercel Serverless Functions
├── /src/
│   ├── /components/
│   │   ├── /nodes/             # Custom React Flow nodes (Ingredient, Process, Glassware)
│   │   └── /workspace/         # Main React Flow canvas and sidebar elements
│   ├── /lib/
│   │   └── /supabase/          # Supabase client initialization & DB helpers
│   ├── /utils/
│   │   ├── calculations.js     # Pure functions for GP, cost, and margins
│   │   └── export.js           # Logic mapping flow data to PDF/Excel layouts
