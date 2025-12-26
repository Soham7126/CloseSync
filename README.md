# My Next.js App

A modern web application built with Next.js 16, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase
- **AI:** OpenAI
- **State Management:** Zustand

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd my-nextjs-app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   Configure the following variables in `.env.local`:

   | Variable | Description |
   |----------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (server-side only) |
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `NEXT_PUBLIC_APP_URL` | Your application URL |

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
my-nextjs-app/
├── src/
│   └── app/              # App Router pages and layouts
│       ├── layout.tsx    # Root layout
│       ├── page.tsx      # Home page
│       └── globals.css   # Global styles
├── public/               # Static assets
├── .env.example          # Environment variables template
├── next.config.ts        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Environment Variables

See `.env.example` for all required environment variables.

### Getting API Keys

- **Supabase:** Create a project at [supabase.com](https://supabase.com) and get your keys from Settings > API
- **OpenAI:** Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## License

MIT License
