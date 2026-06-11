import jwt from "jsonwebtoken";
import { JwtPayload } from "./types";

const SECRET = process.env.JWT_SECRET!;

if (!SECRET) {
  throw new Error("❌ JWT_SECRET no está definido en .env");
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
