'use strict';
const { Validator } = require('./engine');
function validateTask(input) { try { Validator.task(input); return { valid: true, errors: [] }; } catch (error) { return { valid: false, errors: error.details?.errors || [error.message] }; } }
function validateWorkflow(input) { try { Validator.workflow(input); return { valid: true, errors: [] }; } catch (error) { return { valid: false, errors: error.details?.errors || [error.message] }; } }
module.exports = { validateTask, validateWorkflow };
