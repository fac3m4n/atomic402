import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Hello from Hono!" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

export default {
  port,
  fetch: app.fetch,
};

