import rateLimit from "express-rate-limit";
import { config } from "../config";

export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests — please slow down",
    retryAfter: `${config.RATE_LIMIT_WINDOW_MS / 1000}s`,
  },
  skip: (req) => req.path === "/health",
});
