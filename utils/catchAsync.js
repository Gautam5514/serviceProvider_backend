// Eliminates try/catch boilerplate — any rejected promise is forwarded to Express error handler
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
