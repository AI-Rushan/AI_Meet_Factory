import { AuthPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export {};
