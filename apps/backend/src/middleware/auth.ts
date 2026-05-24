import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";

export const authRequired = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    req.auth = verifyToken(authHeader.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const adminRequired = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    req.auth = verifyToken(authHeader.slice(7));
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (!req.auth.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
};
