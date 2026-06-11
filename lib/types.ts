import { NextRequest } from "next/server";
import { $Enums } from "@/generated/prisma/client";

// Payload que va dentro del JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: $Enums.Role;
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
