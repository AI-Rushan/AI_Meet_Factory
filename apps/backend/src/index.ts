import express from "express";
import cors from "cors";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { meetingsRouter } from "./routes/meetings";
import { adminRouter } from "./routes/admin";
import { bootstrap } from "./bootstrap";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/me/meetings", meetingsRouter);
app.use("/api/admin", adminRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error.message });
});

bootstrap()
  .then(() => {
    app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API started on http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("API bootstrap failed", error);
    process.exit(1);
  });
