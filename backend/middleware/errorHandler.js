import { errorResponse } from '../utils/apiResponse.js';

export const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler Log]:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorData = {};

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database validation failed';
    Object.keys(err.errors).forEach((key) => {
      errorData[key] = [err.errors[key].message];
    });
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value entered`;
    errorData[field] = [`${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`];
  }

  // Handle Mongoose Cast Error (e.g. invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with id of ${err.value}`;
    errorData[err.path] = [`Invalid ID format`];
  }

  // Handle JSONWebTokenError / TokenExpiredError
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Not authorized to access this route';
    errorData.token = ['Invalid token signature'];
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please log in again';
    errorData.token = ['Token has expired'];
  }

  // If environment is development, we can attach stack trace if needed, but not raw DB errors in message
  if (process.env.NODE_ENV === 'development' && !res.headersSent) {
    errorData.stack = err.stack;
  }

  return errorResponse(res, statusCode, message, errorData);
};
