# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run db:seed        # create schema + sample data in taskr.db
npm run db:reset       # rm taskr.db and re-seed
npm run dev            # node --watch src/index.js (port 3000, GET /health to verify)
npm start              # node src/index.js
npm test               # jest
npx jest tests/tasks.test.js               # single file
npx jest tests/tasks.test.js -t "returns all tasks"   # single test
```

No linter or formatter is configured.

## Layering rules

Requests flow **route → service → query → database connection**: routes call services, services call queries, and queries call the connection in `src/db/connection.js`. Each layer has one job:

- **Routes** (`src/routes/`) read `req`, call one service function, and send the response. No validation, SQL or business rules. Errors go through `next(err)`.
- **Services** (`src/services/`) hold validation, business rules and error mapping. They throw plain `{ status, message }` objects (including 404s, 409s from UNIQUE violations, etc.). They call `src/db/queries/*` and never touch the `db` connection directly.
- **Queries** (`src/db/queries/`) hold SQL only: no HTTP concepts, no validation, no `status` codes. They are the only layer that imports the `db` connection.

## Never do these things

- Never put SQL anywhere except `src/db/queries/`, and never `require('../db/connection')` from a route or service.
- Never send an error response from a handler with `res.status(...).json(...)`. Use `next({ status, message })` so the central error handler formats it.
- Never put business logic or validation in a route file.
- Never add a utility to `src/utils/` without first checking whether it belongs in a more specific module (a service, a query, or middleware).
- Never create a circular import between layers. Dependencies only point down: routes → services → queries → connection. Services may call other resources' queries (e.g. the tasks service reads projects and users), but not another resource's service for data access.

## Context files

Read the relevant file before starting the task:

- `context/api-conventions.md` — for any task involving API routes or endpoints.
- `context/testing-standards.md` — for any task involving tests or test coverage.

## Folder structure

Express 5 + `better-sqlite3` REST API (users, projects, tasks, comments, tags), CommonJS.

```
src/
  index.js              app wiring only: json parsing, logger, router registration, error handler.
                        Exports the app; listens only when run directly, so supertest can import it.
  routes/               one file per resource, each exporting a named <resource>Router
    root.js health.js webhooks.js users.js projects.js tasks.js comments.js tags.js
  services/             users, projects, tasks, comments, tags + notifications (email stub that only logs)
  db/
    connection.js       the single shared connection (WAL, foreign keys on); exports { db }.
                        Uses :memory: when NODE_ENV=test, otherwise DB_PATH or taskr.db.
    schema.js           createSchema(db): the only copy of the table DDL, used by seed and tests
    seed.js             creates the schema and sample data (skips if users already exist)
    queries/            users, projects, tasks, comments, tags
  middleware/
    auth.js             authenticate checks x-api-key against API_KEY (default dev-key)
    logger.js           requestLogger
    error-handler.js    errorHandler: responds { error: err.message } with err.status || 500
  utils/
    constants.js        PORT, VALID_TASK_STATUSES (active|completed|archived), page-size limits
    validation.js       validateEmail, isNonEmptyString
tests/                  resource.test.js files, run through supertest
```

Routing notes:

- Routers are mounted in `src/index.js`. Comments and tag assignment are nested under tasks (`/tasks/:id/comments`, `/tasks/:id/tags`); their routers use `Router({ mergeParams: true })` and are mounted before `/tasks`.
- `authenticate` is only applied to `DELETE /users/:id` and `DELETE /projects/:id`.
- Email is sent from the users service through `services/notifications.js`.

## Naming conventions

- **All files use kebab-case**, lowercase, with the `.js` extension: `error-handler.js`, `connection.js`, `users.js`. Never use camelCase or PascalCase file names.
- Route, service and query files are named after the resource in **lowercase plural** (`tasks.js`, `users.js`), and the same name is used in all three layers: `src/routes/tasks.js`, `src/services/tasks.js`, `src/db/queries/tasks.js`. Utility routes with no resource behind them (`root.js`, `health.js`) are the exception.
- Routers are exported by name as `<resource>Router` (`tasksRouter`), not as a default export.
- Test files are `tests/<resource>.test.js`.
- Inside files, JavaScript identifiers are camelCase. Request body fields, query parameters and database columns stay snake_case (`project_id`, `page_size`).

## Preserved behaviors that look like bugs

The refactor was a pure restructure, so these existing behaviors were kept on purpose and are pinned by tests. Change them deliberately, not by accident:

- `PUT /users/:id` with another user's email returns **500** (raw `UNIQUE` message), unlike `POST /users`, which returns 409.
- Bad foreign keys on `POST`/`PUT /projects` (`owner_id`) and `PUT /tasks/:id` (`project_id`) return **500** with the raw `FOREIGN KEY` message. Deleting a project that still has tasks, or a task that still has comments, does the same.
- `DELETE /tasks/:id/tags/:tagId` never checks that the task exists; an unknown task gives 404 "Tag not applied to this task".
- `PUT /projects/:id` and `PUT /users/:id` do not validate `name`/`email`.

## Testing

- Test files are named `resource.test.js` (e.g. `tasks.test.js`) and live in `tests/`. Jest `testMatch` in `package.json` is `**/tests/*.test.js`, so a file with a different name won't run.
- Tests must set `process.env.NODE_ENV = 'test'` **before** requiring `../src/index` or `../src/db/connection` to get the in-memory DB. They create tables with `createSchema` from `src/db/schema.js`, the same module the seed uses, so there is one schema to maintain.
- Tests wipe and reseed tables in `beforeEach` (user id 1, project id 1 where needed) and exercise the app through supertest.
