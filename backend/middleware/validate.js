export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = {};
    result.error.issues.forEach((err) => {
      const field = err.path.join('.');
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(err.message);
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: errors,
    });
  }

  // Replace req.body with the parsed/validated data (this applies defaults/strips extra fields)
  req.body = result.data;
  next();
};
