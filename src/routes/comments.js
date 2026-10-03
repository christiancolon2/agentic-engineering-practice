const express = require('express');
const commentsService = require('../services/comments');

// Mounted at /tasks/:id/comments, so it needs the parent's :id param.
const commentsRouter = express.Router({ mergeParams: true });

commentsRouter.get('/', (req, res, next) => {
  try {
    res.json(commentsService.listComments(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

commentsRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(commentsService.createComment(parseInt(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = { commentsRouter };
