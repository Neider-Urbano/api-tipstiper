import { HttpError } from "./HttpError";
import { $Enums } from "@/generated/prisma/client";

export const allowedRoles = [$Enums.Role.TIPSTER, $Enums.Role.BETTOR];

export function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, "La contraseña debe tener mínimo 8 caracteres");
  }
}
