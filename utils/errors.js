class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class NotFoundError extends AppError {
  constructor(resource, identifier) {
    super(`${resource} '${identifier}' not found`, 404, 'NOT_FOUND');
    this.resource = resource;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

module.exports = { AppError, NotFoundError, ValidationError };
