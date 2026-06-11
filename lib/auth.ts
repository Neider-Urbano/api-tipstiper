import { verifyToken } from "./jwt";
import { JwtPayload } from "./types";
import { $Enums } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Extrae y verifica el JWT del header Authorization
export function getAuthUser(req: NextRequest): JwtPayload | null {
  try {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;

    const token = header.split(" ")[1];
    return verifyToken(token);
  } catch {
    return null;
  }
}

// Wrapper para rutas protegidas
// Uso: return requireAuth(req, async (user) => { ... })
export async function requireAuth(
  req: NextRequest,
  handler: (user: JwtPayload) => Promise<NextResponse>,
): Promise<NextResponse> {
  const user = getAuthUser(req);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No autorizado. Incluye el token en Authorization: Bearer <token>",
      },
      { status: 401 },
    );
  }

  return handler(user);
}

// Igual pero exige un rol específico
export async function requireRole(
  req: NextRequest,
  role: $Enums.Role,
  handler: (user: JwtPayload) => Promise<NextResponse>,
): Promise<NextResponse> {
  return requireAuth(req, async (user) => {
    if (user.role !== role) {
      return NextResponse.json(
        {
          success: false,
          error: `Solo los ${role === $Enums.Role.TIPSTER ? "tipsters" : "apostadores"} pueden hacer esto`,
        },
        { status: 403 },
      );
    }
    return handler(user);
  });
}
