import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { SubStatus } from "@/generated/prisma/enums";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return requireAuth(req, async () => {
    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        bio: true,
        avatarUrl: true,
        isVerified: true,
        subscriptionPrice: true,
        createdAt: true,
        role: true,
        stats: true,
        bettorStats: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    // Contar seguidores
    const [followersCount, followingCount, activeSubsCount] = await Promise.all(
      [
        prisma.follow.count({
          where: { tipsterId: user.id },
        }),
        prisma.follow.count({
          where: { followerId: user.id },
        }),
        prisma.subscription.count({
          where: {
            bettorId: user.id,
            status: SubStatus.ACTIVE,
          },
        }),
      ],
    );

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...user,
          followersCount,
          followingCount,
          activeSubsCount,
        },
      },
    });
  });
}
