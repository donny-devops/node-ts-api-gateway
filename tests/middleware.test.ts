import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/index";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "test-secret-key-at-least-32-characters";

function makeToken(role: "admin" | "user" | "readonly" = "user"): string {
  return jwt.sign({ sub: "user-123", email: "test@example.com", role }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Health endpoint", () => {
  it("returns 200 with status healthy", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});

describe("Auth middleware", () => {
  it("rejects requests without Authorization header", async () => {
    const res = await request(app).get("/api/v1/items");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/items")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("accepts requests with valid token", async () => {
    const res = await request(app)
      .get("/api/v1/items")
      .set("Authorization", `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
  });
});

describe("Items CRUD", () => {
  const token = makeToken("admin");
  let createdId: number;

  it("creates an item", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "test-item", description: "A test" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("test-item");
    createdId = res.body.id as number;
  });

  it("lists items", async () => {
    const res = await request(app)
      .get("/api/v1/items")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("gets item by id", async () => {
    const res = await request(app)
      .get(`/api/v1/items/${createdId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
  });

  it("returns 404 for missing item", async () => {
    const res = await request(app)
      .get("/api/v1/items/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("updates an item", async () => {
    const res = await request(app)
      .put(`/api/v1/items/${createdId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "updated-item" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("updated-item");
  });

  it("deletes an item", async () => {
    const res = await request(app)
      .delete(`/api/v1/items/${createdId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("rejects invalid body", async () => {
    const res = await request(app)
      .post("/api/v1/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "no name" });
    expect(res.status).toBe(400);
  });
});
