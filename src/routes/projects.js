const express = require('express');
const projectsService = require('../services/projects');
const { authenticate } = require('../middleware/auth');

const projectsRouter = express.Router();

projectsRouter.get('/', (req, res, next) => {
  try {
    res.json(projectsService.listProjects());
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(projectsService.createProject(req.body));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:id', (req, res, next) => {
  try {
    res.json(projectsService.getProjectById(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

projectsRouter.put('/:id', (req, res, next) => {
  try {
    res.json(projectsService.updateProject(parseInt(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', authenticate, (req, res, next) => {
  try {
    res.json(projectsService.deleteProject(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

module.exports = { projectsRouter };
