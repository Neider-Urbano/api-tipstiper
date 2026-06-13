import { $Enums } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// ── POST — Seguir tipster ────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { tipsterId: string } },
) {
  return requireAuth(req, async (authUser) => {
    const { tipsterId } = params;

    // No puedes seguirte a ti mismo
    if (authUser.userId === tipsterId) {
      return NextResponse.json(
        { success: false, error: "No puedes seguirte a ti mismo" },
        { status: 400 },
      );
    }

    // Verificar que el tipster existe y tiene rol TIPSTER
    const tipster = await prisma.user.findUnique({
      where: { id: tipsterId },
      select: { id: true, username: true, role: true },
    });

    if (!tipster || tipster.role !== $Enums.Role.TIPSTER) {
      return NextResponse.json(
        { success: false, error: "Tipster no encontrado" },
        { status: 404 },
      );
    }

    // Verificar que no lo sigo ya
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_tipsterId: {
          followerId: authUser.userId,
          tipsterId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Ya sigues a @${tipster.username}` },
        { status: 409 },
      );
    }

    const follow = await prisma.follow.create({
      data: {
        followerId: authUser.userId,
        tipsterId,
      },
      select: {
        id: true,
        createdAt: true,
        tipster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            stats: {
              select: { yield: true, winRate: true, totalPicks: true },
            },
          },
        },
      },
    });

    // Contar total de seguidores actualizado
    const followersCount = await prisma.follow.count({
      where: { tipsterId },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Ahora sigues a @${tipster.username}`,
        data: { follow, followersCount },
      },
      { status: 201 },
    );
  });
}

// ── DELETE — Dejar de seguir ─────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { tipsterId: string } },
) {
  return requireAuth(req, async (authUser) => {
    const { tipsterId } = params;

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_tipsterId: {
          followerId: authUser.userId,
          tipsterId,
        },
      },
    });

    if (!follow) {
      return NextResponse.json(
        { success: false, error: "No sigues a este tipster" },
        { status: 404 },
      );
    }

    await prisma.follow.delete({
      where: {
        followerId_tipsterId: {
          followerId: authUser.userId,
          tipsterId,
        },
      },
    });

    const followersCount = await prisma.follow.count({
      where: { tipsterId },
    });

    return NextResponse.json({
      success: true,
      message: "Has dejado de seguir a este tipster",
      data: { followersCount },
    });
  });
}
