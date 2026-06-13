import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { $Enums } from "@/generated/prisma/client";

interface UpdateProfileBody {
  bio?: string;
  avatarUrl?: string;
  subscriptionPrice?: number; // precio mensual en COP que cobrará a suscriptores
}

export async function PATCH(req: NextRequest) {
  return requireRole(req, $Enums.Role.TIPSTER, async (authUser) => {
    const body: UpdateProfileBody = await req.json();
    const { bio, avatarUrl, subscriptionPrice } = body;

    // Al menos un campo debe venir
    if (!bio && !avatarUrl && subscriptionPrice === undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes enviar al menos un campo para actualizar: bio, avatarUrl o subscriptionPrice",
        },
        { status: 400 },
      );
    }

    // Validaciones
    if (bio !== undefined && bio.length > 300) {
      return NextResponse.json(
        { success: false, error: "La bio no puede superar los 300 caracteres" },
        { status: 400 },
      );
    }

    if (avatarUrl !== undefined) {
      try {
        new URL(avatarUrl);
      } catch {
        return NextResponse.json(
          { success: false, error: "avatarUrl debe ser una URL válida" },
          { status: 400 },
        );
      }
    }

    if (subscriptionPrice !== undefined) {
      if (subscriptionPrice < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "El precio de suscripción no puede ser negativo",
          },
          { status: 400 },
        );
      }
      if (subscriptionPrice > 0 && subscriptionPrice < 5000) {
        return NextResponse.json(
          {
            success: false,
            error: "El precio mínimo de suscripción es $5.000 COP",
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: authUser.userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(subscriptionPrice !== undefined && { subscriptionPrice }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        subscriptionPrice: true,
        isVerified: true,
        stats: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Perfil actualizado correctamente",
      data: { user: updated },
    });
  });
}
