import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

interface UpdateProfileBody {
  bio?: string;
  username?: string;
  subscriptionPrice?: number; // precio mensual en COP que cobrará a suscriptores
}

export async function PATCH(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    const body: UpdateProfileBody = await req.json();
    const { bio, username, subscriptionPrice } = body;

    // Al menos un campo debe venir
    if (!bio && !username && subscriptionPrice === undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Debes enviar al menos un campo para actualizar: bio, username o subscriptionPrice",
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

    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: username.toLowerCase(),
          NOT: {
            id: authUser.userId,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `Este username ya está registrado` },
          { status: 409 },
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
        ...(username !== undefined && { username }),
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
