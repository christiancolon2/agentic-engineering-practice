# API Conventions: Adding a New Endpoint

Follow these steps whenever you add a new API endpoint to the Taskr API. These conventions describe the post-refactor layout under `src/`. Do not add new routes to `routes.js`, and do not put new code in `misc/`.

## 1. Put the route in its own file in `src/routes/`

- Create one route file per resource at `src/routes/<resource>.js`.
- The file name is the resource name in **lowercase plural**: `tasks.js`, `projects.js`, `users.js`, `comments.js`, `tags.js`.
- If the resource already has a route file, add the endpoint there. Don't create a second file for the same resource.

## 2. Export a named Express router

Each route file exports a **named** router, not a default export.

```js
// src/routes/tasks.js
const express = require('express');
const tasksService = require('../services/tasks');

const tasksRouter = express.Router();

tasksRouter.get('/:id', (req, res, next) => {
  try {
    const task = tasksService.getTaskById(req.params.id);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

module.exports = { tasksRouter };
```

The export name is `<resource>Router`, for example `tasksRouter`.

## 3. Handlers call a service function and hold no business logic

- Every route handler calls a matching function in `src/services/<resource>.js`.
- Handlers only read from `req`, call the service, and send the response.
- Validation, SQL or other database access, and business rules all live in the service layer, never in the handler.
- Add the service function first if it doesn't exist. Name it after the action, such as `getTaskById`, `createTask` or `deleteTask`.

## 4. Pass errors to `next` as an object with a status code and message

- Never send error responses directly from a handler with `res.status(...).json(...)`.
- Pass errors to Express's `next` function as an object with `status` and `message`.
- Services may throw `{ status, message }` objects. Handlers catch them and call `next(err)`.

```js
// in a service
if (!task) {
  throw { status: 404, message: 'Task not found' };
}

// in a handler
catch (err) {
  next(err);
}

// or directly from a handler
next({ status: 400, message: 'title is required' });
```

The central error handler reads `err.status`, so always set it.

## 5. Register the router in `src/index.js`

Register every router in `src/index.js` with `app.use`, the resource path, and the imported router.

```js
const { tasksRouter } = require('./routes/tasks');

app.use('/tasks', tasksRouter);
```

- The resource path matches the resource name, for example `/tasks`.
- A route file that isn't registered in `src/index.js` is unreachable.

## Checklist

- [ ] Route lives in `src/routes/<resource>.js` (lowercase plural)
- [ ] File exports a named router (`<resource>Router`)
- [ ] Each handler calls a function in `src/services/<resource>.js`
- [ ] No business logic, validation or SQL in the handler
- [ ] Errors go through `next({ status, message })`
- [ ] Router registered in `src/index.js` with `app.use('/<resource>', <resource>Router)`
- [ ] Tests added in `tests/<resource>.test.js`
