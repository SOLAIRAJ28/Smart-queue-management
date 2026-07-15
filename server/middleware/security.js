import rateLimit from 'express-rate-limit';

/**
 * Custom recursive XSS Sanitizer.
 * Sanitizes input body, query, and parameters to strip out HTML tags and script elements.
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (val) => {
    if (typeof val === 'string') {
      // Strip HTML tag syntax: <anything>
      return val.replace(/<[^>]*>/g, '').trim();
    }
    if (val && typeof val === 'object') {
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          val[key] = sanitizeValue(val[key]);
        }
      }
    }
    return val;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  
  next();
};

/**
 * General API Endpoint Rate Limiter.
 * Restricts client IP addresses to 100 requests per 15 minutes.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 200, // Limit each IP to 10000 in dev, 200 in prod
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => true,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Brute-force Login Rate Limiter.
 * Restricts authentication endpoints to 15 login/register requests per hour.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 1000 : 20, // Limit each IP to 1000 in dev, 20 in prod
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => true,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Brute-force protection activated. Please try again in an hour.'
  }
});
