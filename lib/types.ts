import { NextRequest } from "next/server";

// Payload que va dentro del JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: "TIPSTER" | "BETTOR";
}

// NextRequest extendido con el usuario autenticado
export interface AuthenticatedRequest extends NextRequest {
  user: JwtPayload;
}

// Respuesta estándar de la API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
