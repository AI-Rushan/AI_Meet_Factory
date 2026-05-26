import { Router } from "express";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../dto/auth";
import { authRequired } from "../middleware/auth";
import { authService } from "../services/authService";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const payload = registerSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    const result = await authService.register(payload.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  const payload = loginSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    const result = await authService.login(payload.data);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (error instanceof Error && error.message === "NO_WORKSPACE_MEMBERSHIP") {
      res.status(403).json({ error: "No workspace membership" });
      return;
    }

    res.status(500).json({ error: "Login failed" });
  }
});

authRouter.get("/session", authRequired, async (req, res) => {
  const session = await authService.getSession(req.auth!);
  if (!session) {
    res.status(401).json({ error: "Session is invalid" });
    return;
  }

  res.json(session);
});

authRouter.post("/forgot-password", async (req, res) => {
  const payload = forgotPasswordSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    await authService.forgotPassword(payload.data);
    // Always respond with 200 to avoid email enumeration
    res.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password] error:", err);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const payload = resetPasswordSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.flatten() });
    return;
  }

  try {
    await authService.resetPassword(payload.data);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_OR_EXPIRED_TOKEN") {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }
    res.status(500).json({ error: "Password reset failed" });
  }
});
