const express = require('express');
const tasksService = require('../services/tasks');

const tasksRouter = express.Router();

tasksRouter.get('/', (req, res, next) => {
  try {
    res.json(tasksService.listTasks(req.query));
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(tasksService.createTask(req.body));
  } catch (err) {
    next(err);
  }
});

tasksRouter.get('/:id', (req, res, next) => {
  try {
    res.json(tasksService.getTaskById(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

tasksRouter.put('/:id', (req, res, next) => {
  try {
    res.json(tasksService.updateTask(parseInt(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/:id', (req, res, next) => {
  try {
    res.json(tasksService.deleteTask(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

module.exports = { tasksRouter };
