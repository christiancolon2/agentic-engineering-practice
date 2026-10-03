const PORT = process.env.PORT || 3000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const VALID_TASK_STATUSES = ['active', 'completed', 'archived'];

module.exports = { PORT, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, VALID_TASK_STATUSES };
