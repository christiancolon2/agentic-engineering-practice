# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run db:seed        # create schema + sample data in taskr.db
npm run db:reset       # rm taskr.db and re-seed
npm run dev            # node --watch index.js (port 3000, GET /health to verify)
npm start
npm test               # jest
npx jest tests/tasks.test.js               # single file
npx jest tests/tasks.test.js -t "returns all tasks"   # single test
```

No linter or formatter is configured.

## Known structural problems (refactor planned)

This codebase has intentional structural problems that will be addressed in an upcoming refactor. Understand the current state, but don't reinforce the bad patterns:

- Don't treat existing patterns as conventions to copy. Inline SQL in route handlers, inline validation, one giant `routes.js`, and query helpers in `DB.js` are known problems, not house style.
- When adding or changing code, prefer the direction the TODOs point: separate route files per resource, a repository layer for queries, shared validation middleware, a notification service for email, and `logger.js`/`error-handler.js` split out of `middleware.js`.
- Don't add to the mess: no new routes appended to `routes.js` with inline SQL, no new logic in `UserController.js`'s email-in-controller pattern, no new code in `misc/` or new lazy-`require` workarounds for circular imports.
- Keep changes scoped. Don't opportunistically restructure existing code unless asked, since the refactor is planned separately. If a task forces a choice between matching a bad pattern and diverging from it, say so and ask.

## Never do these things

- Never add new route logic to `routes.js`. It is already too large; any new routes belong in dedicated route files.
- Never add new utility functions to `utils.js` without first checking whether they belong in a more specific module.
- Never import from files in the `misc/` directory. That code is dead and scheduled for removal.

## Context files

Read the relevant file before starting the task:

- `context/api-conventions.md` — for any task involving API routes or endpoints.
- `context/testing-standards.md` — for any task involving tests or test coverage.

## Architecture

Express 5 + `better-sqlite3` REST API (users, projects, tasks, comments, tags). Flat layout, no `src/` dir. The sections below describe the current state, warts included.

- `index.js` — builds the app and exports it (listens only when run directly, so supertest can import it). Also defines `/` and `POST /webhooks/task-update` inline, outside the router.
- `routes.js` — nearly all routes in one file, with inline SQL and inline validation against `db` directly. Exception: `/users*` delegates to `UserController.js` (which also sends the welcome email via `sendEmail.js`, a stub that only logs). `routes.js` also holds tag and comment routes.
- `get-tasks.js` — query helpers for tasks (`getTasks` with filters/pagination, `getTaskById` with tags and comments joined).
- `DB.js` — the single shared connection (WAL, foreign keys on) plus a couple of stray query helpers. Uses `:memory:` when `NODE_ENV=test`, otherwise `DB_PATH` or `taskr.db`.
- `auth.js` — `authenticate` checks the `x-api-key` header against `API_KEY` (default `dev-key`). Only applied to `DELETE /users/:id` and `DELETE /projects/:id`.
- `middleware.js` — request logger and error handler (errors use `err.status`; controllers throw errors with `.status` set).
- `misc/constants.js` — config (`PORT`), `VALID_TASK_STATUSES` (`active|completed|archived`), plus misplaced `paginate`/`formatError` helpers. `utils.js` has other validators/formatters.
- `projectHelpers.js` — has a circular dependency with `routes.js`, handled by lazy `require` inside functions. Keep requires lazy there.
- `misc/oldRoutes.js` and `misc/temp.js` are dead code.

## Testing

- New test files should be named `resource.test.js` (e.g. `tasks.test.js`). The inconsistent naming currently in `tests/` (`userTest.js`, `test-projects.js`) is a known problem that will be standardized; don't copy it.
- Jest `testMatch` in `package.json` is explicit: `tests/*.test.js`, `tests/userTest.js`, `tests/test-projects.js`. A new test file with a different name won't run unless it matches or the config is updated.
- Tests must set `process.env.NODE_ENV = 'test'` **before** requiring `../index`/`../DB` to get the in-memory DB. They create tables with `tests/schema.js` (`createSchema`), which duplicates the schema in `db/seed.js` — keep the two in sync when changing tables.
- Tests wipe and reseed tables in `beforeEach` (user id 1, project id 1) and exercise the app through supertest.
