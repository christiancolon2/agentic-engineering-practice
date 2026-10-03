const express = require('express');
const { PORT } = require('./utils/constants');
const router = require('../routes');
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/error-handler');
const { usersRouter } = require('./routes/users');
const { projectsRouter } = require('./routes/projects');
const { tasksRouter } = require('./routes/tasks');
const { commentsRouter } = require('./routes/comments');
const { tagsRouter, taskTagsRouter } = require('./routes/tags');

const app = express();

app.use(express.json());
app.use(requestLogger);

// These routes were defined here directly and never moved to routes.js
app.get('/', (req, res) => {
  res.json({ name: 'Taskr API', version: '1.0.0', docs: '/health' });
});

app.post('/webhooks/task-update', (req, res) => {
  // TODO: process webhook payload
  console.log('[WEBHOOK] Received:', req.body);
  res.json({ received: true });
});

app.use('/users', usersRouter);
app.use('/projects', projectsRouter);
app.use('/tasks/:id/comments', commentsRouter);
app.use('/tasks/:id/tags', taskTagsRouter);
app.use('/tasks', tasksRouter);
app.use('/tags', tagsRouter);
app.use(router);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Taskr API running on port ${PORT}`);
  });
}

module.exports = app;
