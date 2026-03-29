import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validator";

export const itemsRouter = Router();

// In-memory store (replace with DB layer in production)
interface Item {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

let items: Item[] = [];
let nextId = 1;

// ── Schemas ────────────────────────────────────────────────────────────────────

const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, "name is required").max(255),
    description: z.string().max(1000).nullable().optional(),
  }),
});

const updateItemSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, "id must be numeric") }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
  }),
});

const itemIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, "id must be numeric") }),
});

// ── Handlers ───────────────────────────────────────────────────────────────────

itemsRouter.get("/", authenticate, (_req, res): void => {
  res.json(items);
});

itemsRouter.get("/:id", authenticate, validate(itemIdSchema), (req, res): void => {
  const item = items.find((i) => i.id === Number(req.params["id"]));
  if (!item) throw new AppError(`Item ${req.params["id"]} not found`, 404);
  res.json(item);
});

itemsRouter.post("/", authenticate, validate(createItemSchema), (req, res): void => {
  const body = req.body as { name: string; description?: string | null };
  const item: Item = {
    id: nextId++,
    name: body.name,
    description: body.description ?? null,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  res.status(201).json(item);
});

itemsRouter.put("/:id", authenticate, validate(updateItemSchema), (req, res): void => {
  const idx = items.findIndex((i) => i.id === Number(req.params["id"]));
  if (idx === -1) throw new AppError(`Item ${req.params["id"]} not found`, 404);
  const body = req.body as { name?: string; description?: string | null };
  if (body.name !== undefined) items[idx]!.name = body.name;
  if (body.description !== undefined) items[idx]!.description = body.description;
  res.json(items[idx]);
});

itemsRouter.delete("/:id", authenticate, validate(itemIdSchema), (req, res): void => {
  const idx = items.findIndex((i) => i.id === Number(req.params["id"]));
  if (idx === -1) throw new AppError(`Item ${req.params["id"]} not found`, 404);
  items.splice(idx, 1);
  res.json({ message: `Item ${req.params["id"]} deleted` });
});
