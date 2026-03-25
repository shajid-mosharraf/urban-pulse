/**
 * Send a success response
 * @param {Response} res - Express response object
 * @param {number} statusCode
 * @param {string} message
 * @param {Object} data - optional payload
 */
const sendSuccess = (res, statusCode = 200, message = "Success", data = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {number} statusCode
 * @param {string} message
 * @param {Object} errors - optional field-level errors
 */
const sendError = (res, statusCode = 500, message = "Something went wrong", errors = null) => {
  const response = { success: false, message };
  if (errors !== null) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
