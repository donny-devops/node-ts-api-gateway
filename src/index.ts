import express from "express";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";
import { healthRouter } from "./routes/health";
import { itemsRouter } from "./routes/items";

const app = express();

// Global middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use("/health", healthRouter);
app.use("/api/v1/items", itemsRouter);

// Global error handler (must be last)
app.use(errorHandler);

// Start server only when not in test environment
if (config.NODE_ENV !== "test") {
  app.listen(config.PORT, () => {
    console.info(`API Gateway running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

export { app };
