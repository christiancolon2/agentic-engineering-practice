const express = require('express');
const tagsService = require('../services/tags');

const tagsRouter = express.Router();

tagsRouter.get('/', (req, res, next) => {
  try {
    res.json(tagsService.listTags());
  } catch (err) {
    next(err);
  }
});

tagsRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(tagsService.createTag(req.body));
  } catch (err) {
    next(err);
  }
});

// Applying and removing tags on a task is mounted at /tasks/:id/tags, so it
// needs the parent's :id param.
const taskTagsRouter = express.Router({ mergeParams: true });

taskTagsRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(tagsService.addTagToTask(parseInt(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

taskTagsRouter.delete('/:tagId', (req, res, next) => {
  try {
    res.json(tagsService.removeTagFromTask(parseInt(req.params.id), parseInt(req.params.tagId)));
  } catch (err) {
    next(err);
  }
});

module.exports = { tagsRouter, taskTagsRouter };
