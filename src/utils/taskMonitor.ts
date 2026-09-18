// Lazy boundary for deadline monitoring. Keeping this adapter separate avoids
// pulling the task parser into the application's bootstrap chunk.
export { parseAllTasks, isValidDueDate } from './taskUtils';
