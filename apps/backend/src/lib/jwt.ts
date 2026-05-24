import jwt from "jsonwebtoken";
import { config } from "../config";

export type AuthPayload = {
  userId: string;
  workspaceId: string;
  isAdmin: boolean;
};

export const signToken = (payload: AuthPayload): string =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });

export const verifyToken = (token: string): AuthPayload =>
  jwt.verify(token, config.jwtSecret) as AuthPayload;
