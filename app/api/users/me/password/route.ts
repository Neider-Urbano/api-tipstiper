import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { validatePassword } from "@/lib/user";
import { HttpError } from "@/lib/HttpError";

interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export async function PATCH(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    try {
      const body: UpdatePasswordBody = await req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          {
            success: false,
            error: "La contraseña actual y la nueva son obligatorias",
          },
          { status: 400 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: authUser.userId },
        select: { id: true, password: true },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "Usuario no encontrado" },
          { status: 404 },
        );
      }

      const currentMatch = await bcrypt.compare(currentPassword, user.password);
      if (!currentMatch) {
        return NextResponse.json(
          { success: false, error: "La contraseña actual es incorrecta" },
          { status: 401 },
        );
      }

      validatePassword(newPassword);

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return NextResponse.json({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    } catch (error) {
      console.error("[POST /api/users/me/password]", error);
      if (error instanceof HttpError) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: error.status },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Error interno del servidor",
        },
        { status: 500 },
      );
    }
  });
}
