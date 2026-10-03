# Testing Standards: Writing Tests for the Taskr API

Follow these standards whenever you write or change tests for the Taskr API.

## 1. Name test files `resource.test.js`

- Use the resource name in lowercase: `tasks.test.js`, `projects.test.js`, `users.test.js`.
- Put test files in `tests/`.
- Do not copy the older inconsistent names (`userTest.js`, `test-projects.js`).
- Jest's `testMatch` in `package.json` is explicit. A file named `resource.test.js` in `tests/` matches `tests/*.test.js` and runs without config changes.

## 2. Use Jest and supertest against an in-memory SQLite database

- Use `jest` as the test runner and `supertest` to exercise the app over HTTP. Import the app from the entry point, which doesn't listen when imported.
- Set `process.env.NODE_ENV = 'test'` **before** requiring the app or the DB module. This switches the DB to `:memory:`, so tests never touch `taskr.db` or any external service.
- Create tables with `createSchema` from `tests/schema.js`.
- Wipe and reseed tables in `beforeEach` so every test starts from the same known state, with user id 1 and project id 1.
- Do not mock the database or the HTTP layer. Test through supertest against the real app.

```js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../DB');
const { createSchema } = require('./schema');

beforeAll(() => {
  createSchema(db);
});

beforeEach(() => {
  db.exec('DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
  // reseed user id 1 and project id 1
});
```

If you change a table, update both `tests/schema.js` and `db/seed.js` so they stay in sync.

## 3. Cover the happy path and at least two error cases per endpoint

For **every** endpoint, the test file needs:

- one test for the happy path, where valid input returns the expected status and body
- at least two tests for error cases

Typical error cases:

- a missing or invalid required field (400)
- a resource that doesn't exist (404)
- a missing or wrong `x-api-key` on protected routes (401)
- a conflict or constraint violation, such as a duplicate or a bad foreign key

Assert on the status code and on the error message in the response body.

```js
describe('GET /tasks/:id', () => {
  it('returns the task with the given id', async () => { /* happy path */ });
  it('returns 404 when the task does not exist', async () => { /* error 1 */ });
  it('returns 400 when the id is not a number', async () => { /* error 2 */ });
});
```

## 4. Write plain-English test descriptions

- Describe what the endpoint does from the caller's point of view, not how it is implemented.
- Start with a verb phrase: "returns...", "creates...", "rejects...".
- Do not mention function names, SQL, tables, or internal modules in a description.

| Good | Bad |
| --- | --- |
| `returns all tasks for a project` | `calls getTasks and returns rows` |
| `rejects a task with no title` | `validateTask throws when title is undefined` |
| `returns 404 when the project does not exist` | `db.get returns undefined` |

Use `describe` blocks named after the endpoint, such as `describe('POST /tasks', ...)`.

## 5. The suite runs with `npm test` and nothing else

- `npm test` must work on a fresh clone after `npm install`. No other setup is needed.
- Do not require `npm run db:seed`, a `taskr.db` file, environment variables set outside the test file, running servers, or network access.
- Tests must not depend on each other or on execution order. Each test sets up its own data.
- Before finishing, run `npm test` and confirm the whole suite passes.

## Checklist

- [ ] File is `tests/<resource>.test.js` (lowercase)
- [ ] `NODE_ENV = 'test'` is set before requiring `../index` or `../DB`
- [ ] Tables are created with `createSchema` and reseeded in `beforeEach`
- [ ] Tests use supertest against the real app, with no mocks of the DB
- [ ] Every endpoint has a happy path and at least two error cases
- [ ] Descriptions are plain English and say what the endpoint does
- [ ] `npm test` passes with no extra setup
