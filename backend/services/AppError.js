// backend/services/AppError.js
class AppError extends Error {
  /**
   * @param {string} message Human‑readable description
   * @param {number} code    HTTP‑style error code (e.g., 400, 404, 409)
   */
  constructor(message, code = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    // Capture stack trace without this constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

module.exports = AppError;
