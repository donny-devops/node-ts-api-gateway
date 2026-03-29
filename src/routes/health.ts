import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response): void => {
  res.json({
    status: "healthy",
    service: "node-ts-api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
