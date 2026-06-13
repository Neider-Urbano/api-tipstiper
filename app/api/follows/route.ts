import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PickStatus } from "../../../generated/prisma/client";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    const { searchParams } = new URL(req.url);

    const view = searchParams.get("view") ?? "both";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? "20")),
    );
    const status = searchParams.get("status") as PickStatus | null;
    const skip = (page - 1) * limit;

    const validViews = ["tipsters", "feed", "both"];
    if (!validViews.includes(view)) {
      return NextResponse.json(
        {
          success: false,
          error: `view inválido. Opciones: ${validViews.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Obtener IDs de tipsters que sigo
    const follows = await prisma.follow.findMany({
      where: { followerId: authUser.userId },
      select: {
        id: true,
        createdAt: true,
        tipster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            subscriptionPrice: true,
            stats: {
              select: {
                yield: true,
                winRate: true,
                totalPicks: true,
                wonPicks: true,
                streak: true,
                unitsWon: true,
              },
            },
            // Último pick para mostrar actividad reciente
            picks: {
              orderBy: { publishedAt: "desc" },
              take: 1,
              select: { publishedAt: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tipsterIds = follows.map((f) => f.tipster.id);

    // Si no sigo a nadie, responder rápido
    if (tipsterIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          tipsters: [],
          feed: {
            items: [],
            pagination: {
              total: 0,
              page: 1,
              limit,
              totalPages: 0,
              hasMore: false,
            },
          },
          totalFollowing: 0,
        },
      });
    }

    // ── Vista: solo tipsters ──────────────────────────────────────────
    if (view === "tipsters") {
      return NextResponse.json({
        success: true,
        data: {
          tipsters: follows.map((f) => f.tipster),
          totalFollowing: follows.length,
        },
      });
    }

    // ── Vista: feed de picks ──────────────────────────────────────────
    const validStatuses = Object.values(PickStatus);
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `status inválido. Opciones: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const feedWhere = {
      tipsterId: { in: tipsterIds },
      ...(status && { status }),
    };

    const [feedPicks, totalFeed] = await Promise.all([
      prisma.pick.findMany({
        where: feedWhere,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          matchDate: true,
          league: true,
          homeTeam: true,
          awayTeam: true,
          pickType: true,
          pickValue: true,
          odds: true,
          stake: true,
          isPremium: true,
          status: true,
          publishedAt: true,
          lockedAt: true,
          analysis: true,
          tipster: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              stats: {
                select: { yield: true, winRate: true },
              },
            },
          },
        },
      }),
      prisma.pick.count({ where: feedWhere }),
    ]);

    // Ocultar análisis premium
    // En fase 2 aquí verificaremos si tiene suscripción activa
    const feedWithAccess = feedPicks.map((pick) => ({
      ...pick,
      analysis:
        pick.isPremium && pick.tipster.id !== authUser.userId
          ? null
          : pick.analysis,
      isPremiumLocked: pick.isPremium && pick.tipster.id !== authUser.userId,
    }));

    const feed = {
      items: feedWithAccess,
      pagination: {
        total: totalFeed,
        page,
        limit,
        totalPages: Math.ceil(totalFeed / limit),
        hasMore: page * limit < totalFeed,
      },
    };

    // ── Vista: both (default) ─────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        tipsters: view === "feed" ? undefined : follows.map((f) => f.tipster),
        feed: view === "tipsters" ? undefined : feed,
        totalFollowing: follows.length,
      },
    });
  });
}
