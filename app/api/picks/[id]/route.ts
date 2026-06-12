import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PickStatus } from "../../../../generated/prisma/client";

// ── GET /api/picks/:id — Detalle de un pick ──────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const pick = await prisma.pick.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      matchId: true,
      matchDate: true,
      league: true,
      homeTeam: true,
      awayTeam: true,
      pickType: true,
      pickValue: true,
      odds: true,
      stake: true,
      isPremium: true,
      analysis: true,
      status: true,
      publishedAt: true,
      lockedAt: true,
      tipster: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          bio: true,
          stats: true,
        },
      },
    },
  });

  if (!pick) {
    return NextResponse.json(
      { success: false, error: "Pick no encontrado" },
      { status: 404 },
    );
  }

  // Verificar acceso al análisis premium
  const authHeader = req.headers.get("authorization");
  let currentUserId: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyToken } = await import("@/lib/jwt");
      const payload = verifyToken(authHeader.split(" ")[1]);
      currentUserId = payload.userId;
    } catch {
      /* anónimo */
    }
  }

  const isPremiumLocked = pick.isPremium && pick.tipster.id !== currentUserId;

  return NextResponse.json({
    success: true,
    data: {
      pick: {
        ...pick,
        analysis: isPremiumLocked ? null : pick.analysis,
        isPremiumLocked,
      },
    },
  });
}

// ── DELETE /api/picks/:id — Eliminar pick ────────────────────────────
// Solo el tipster dueño puede eliminar
// Solo si está en PENDING (no si ya está LOCKED, WON, LOST o VOID)

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return requireAuth(req, async (authUser) => {
    const pick = await prisma.pick.findUnique({
      where: { id: params.id },
      select: { id: true, tipsterId: true, status: true },
    });

    if (!pick) {
      return NextResponse.json(
        { success: false, error: "Pick no encontrado" },
        { status: 404 },
      );
    }

    // Solo el dueño puede eliminar
    if (pick.tipsterId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: "No tienes permiso para eliminar este pick" },
        { status: 403 },
      );
    }

    // Solo si está PENDING
    if (pick.status !== PickStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: `No puedes eliminar un pick en estado ${pick.status}. Solo se pueden eliminar picks en PENDING`,
        },
        { status: 400 },
      );
    }

    await prisma.pick.delete({ where: { id: params.id } });

    return NextResponse.json({
      success: true,
      message: "Pick eliminado correctamente",
    });
  });
}
