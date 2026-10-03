const express = require('express');
const usersService = require('../services/users');
const { authenticate } = require('../middleware/auth');

const usersRouter = express.Router();

usersRouter.get('/', (req, res, next) => {
  try {
    res.json(usersService.listUsers());
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/:id', (req, res, next) => {
  try {
    res.json(usersService.getUserById(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

usersRouter.put('/:id', (req, res, next) => {
  try {
    res.json(usersService.updateUser(parseInt(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/:id', authenticate, (req, res, next) => {
  try {
    res.json(usersService.deleteUser(parseInt(req.params.id)));
  } catch (err) {
    next(err);
  }
});

module.exports = { usersRouter };
