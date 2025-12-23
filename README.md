# Arbor

**Thoughts branch. So should your conversations.**

An infinite canvas for AI conversations with branching and visual organization.

## Quick Start

```bash
# Install
npm install

# Setup .env
cp .env.example .env
# Add your keys: CLERK_*, DATABASE_URL, DEDALUS_API_KEY

# Push database schema
npx drizzle-kit push

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Stack

- **Frontend**: Next.js 16, React Flow, Clerk Auth
- **Backend**: Drizzle ORM, Supabase (PostgreSQL)
- **AI**: Dedalus Labs
