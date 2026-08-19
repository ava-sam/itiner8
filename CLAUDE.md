# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Restrictions

Never run `git push`, `git commit`, `git merge`, or any command that writes to the git history or
remote repository, under any circumstances, even if asked. Read-only git commands like `git status`,
`git diff`, and `git log` are fine. All commits and pushes in this project are made by Ava manually.

## Project state

itiner8 is a Next.js + Supabase app, currently at scaffold stage: it started from the official
`with-supabase` Create Next App template (see README.md, which still describes that template
rather than itiner8 itself) and has since been renamed. Most of `app/` and `components/` is still
the unmodified starter-kit tutorial/auth UI. `@vis.gl/react-google-maps` is installed but not yet
used anywhere. Testing dependencies (Vitest, Playwright) are installed but not yet wired up: there
is no `vitest.config.ts` or `test` script in `package.json`, and `e2e/example.spec.ts` is still the
default Playwright example pointed at playwright.dev rather than the app. Expect to scaffold these
before writing real tests.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
npx playwright test              # run e2e tests (once configured beyond the example spec)
npx playwright test e2e/foo.spec.ts   # run a single e2e file
```

No `test` script exists yet for Vitest — run it directly with `npx vitest` once a config is added.

Supabase CLI is linked to a remote project (`supabase/config.toml`, project_id `itiner8`); use the
`supabase` CLI for local DB/dev workflows (`supabase start`, `supabase db ...`).

## Architecture

- **Auth via `@supabase/ssr`, cookie-based**, with three separate client constructors that must not
  be mixed up:
  - `lib/supabase/client.ts` — browser client (Client Components).
  - `lib/supabase/server.ts` — server client (Server Components/Actions), creates a fresh client
    per request/function call (never cache/globalize it — matters for Fluid compute).
  - `lib/supabase/proxy.ts` — `updateSession()`, used from the root `proxy.ts` (this project's
    equivalent of Next.js middleware) to refresh the session cookie on every request and redirect
    unauthenticated users to `/auth/login` for any path other than `/`, `/login*`, `/auth*`. When
    editing session refresh logic, preserve the exact cookie propagation pattern in that file
    (comments there explain why) — getting it wrong causes silent, hard-to-debug session drops.
  - `lib/utils.ts` exports `hasEnvVars`, used throughout to decide whether to render Supabase UI
    or an `EnvVarWarning`/tutorial fallback (this gate is temporary/tutorial scaffolding).
- **Route structure**: `app/auth/*` (login, sign-up, forgot/update password, error, email confirm
  route handler) is public; `app/dashboard/*` is gated by the proxy redirect above.
- **UI components** follow shadcn/ui conventions: primitives in `components/ui/` (generated via
  shadcn, style "new-york", see `components.json`), composed feature components at the top level
  of `components/`, and starter-kit tutorial-only components under `components/tutorial/`. Use the
  `cn()` helper from `lib/utils.ts` (clsx + tailwind-merge) for conditional classNames, and the
  `@/*` path alias for all internal imports.
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see
  `.env.example`); the publishable key accepts either Supabase's legacy anon key or new publishable
  key format.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
