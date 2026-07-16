import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { $Enums } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

const VALID_WIN_RATES = [50, 65, 75] as const;
type WinRateFilter = (typeof VALID_WIN_RATES)[number];

const VALID_SPORTS = ["soccer", "basketball", "tennis"] as const;
type SportFilter = (typeof VALID_SPORTS)[number];

interface TipstersSearchParams {
  sport: SportFilter;
  minYield: number;
  minWinRate?: WinRateFilter;
  maxPrice?: number;
  page: number;
  limit: number;
}

export async function GET(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    try {
      const { searchParams } = new URL(req.url);

      const requestingUserId = authUser?.userId ?? null;

      const rawSport = searchParams.get("sport") ?? "soccer";
      const rawMinYield = Number(searchParams.get("minYield") ?? "0");
      const rawMinWinRate = Number(searchParams.get("minWinRate"));
      const rawMaxPrice = Number(searchParams.get("maxPrice"));

      const filters: TipstersSearchParams = {
        sport: VALID_SPORTS.includes(rawSport as SportFilter)
          ? (rawSport as SportFilter)
          : "soccer",
        minYield: Number.isFinite(rawMinYield) ? rawMinYield : 0,
        minWinRate: VALID_WIN_RATES.includes(rawMinWinRate as WinRateFilter)
          ? (rawMinWinRate as WinRateFilter)
          : undefined,
        maxPrice:
          Number.isFinite(rawMaxPrice) && rawMaxPrice > 0
            ? rawMaxPrice
            : undefined,
        page: Math.max(1, Number(searchParams.get("page") ?? "1")),
        limit: Math.min(
          50,
          Math.max(1, Number(searchParams.get("limit") ?? "12")),
        ),
      };

      const skip = (filters.page - 1) * filters.limit;

      const where = {
        // totalPicks: { gte: 10 },
        yield: { gte: filters.minYield },
        ...(filters.minWinRate !== undefined && {
          winRate: { gte: filters.minWinRate },
        }),
        user: {
          role: $Enums.Role.TIPSTER,
          isVerified: true,
          ...(requestingUserId ? { id: { not: requestingUserId } } : {}),
          ...(filters.maxPrice !== undefined && {
            subscriptionPrice: { lte: filters.maxPrice },
          }),
          // picks: {
          //   some: {
          //     sport: filters.sport,
          //   },
          // },
        },
      };

      const [tipsters, total] = await Promise.all([
        prisma.tipsterStats.findMany({
          where,
          orderBy: { yield: "desc" },
          skip,
          take: filters.limit,
          select: {
            yield: true,
            winRate: true,
            totalPicks: true,
            wonPicks: true,
            unitsWon: true,
            streak: true,
            badge: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                bio: true,
                isVerified: true,
                subscriptionPrice: true,
                createdAt: true,
                picks: {
                  where: {
                    // sport: filters.sport,
                    publishedAt: {
                      gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                  },
                  select: { id: true },
                },
              },
            },
          },
        }),

        prisma.tipsterStats.count({ where }),
      ]);

      const mapped = tipsters.map((t) => ({
        id: t.user.id,
        username: t.user.username,
        avatarUrl: t.user.avatarUrl,
        isVerified: t.user.isVerified,
        subscriptionPrice: t.user.subscriptionPrice,
        bio: t.user.bio,
        createdAt: t.user.createdAt,
        badge: t.badge ?? null,
        picksToday: t.user.picks.length,
        stats: {
          totalPicks: t.totalPicks,
          wonPicks: t.wonPicks,
          yield: Number(t.yield),
          winRate: Number(t.winRate),
          unitsWon: Number(t.unitsWon),
          streak: t.streak,
        },
      }));

      return NextResponse.json({
        success: true,
        data: {
          tipsters: mapped,
          pagination: {
            total,
            page: filters.page,
            limit: filters.limit,
            totalPages: Math.ceil(total / filters.limit),
            hasMore: filters.page * filters.limit < total,
          },
          meta: {
            // sport: filters.sport,
            minYield: filters.minYield,
            minWinRate: filters.minWinRate ?? null,
            maxPrice: filters.maxPrice ?? null,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching tipsters:", error);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }
  });
}
