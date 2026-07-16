import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { $Enums, PickStatus } from "@/generated/prisma/client";

type OrderByField = "yield" | "winRate" | "totalPicks" | "unitsWon";

const VALID_ORDER_FIELDS: OrderByField[] = [
  "yield",
  "winRate",
  "totalPicks",
  "unitsWon",
];

interface RankingSearchParams {
  orderBy: OrderByField;
  minPicks: number;
  page: number;
  limit: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const filters: RankingSearchParams = {
    orderBy: (searchParams.get("orderBy") ?? "yield") as OrderByField,
    minPicks: Math.max(1, Number(searchParams.get("minPicks") ?? "10")),
    page: Math.max(1, Number(searchParams.get("page") ?? "1")),
    limit: Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "20"))),
  };

  const skip = (filters.page - 1) * filters.limit;

  // Validar campo de ordenamiento
  if (!VALID_ORDER_FIELDS.includes(filters.orderBy)) {
    return NextResponse.json(
      {
        success: false,
        error: `orderBy inválido. Opciones: ${VALID_ORDER_FIELDS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Solo tipsters verificados con mínimo de picks
  // para evitar que alguien con 1 pick ganado aparezca primero
  const [tipsters, total] = await Promise.all([
    prisma.tipsterStats.findMany({
      where: {
        totalPicks: { gte: filters.minPicks },
        user: { isVerified: true, role: $Enums.Role.TIPSTER },
      },
      orderBy: { [filters.orderBy]: "desc" },
      skip,
      take: filters.limit,
      select: {
        yield: true,
        winRate: true,
        totalPicks: true,
        wonPicks: true,
        unitsWon: true,
        roi: true,
        streak: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            picks: {
              where: {
                status: {
                  in: [PickStatus.WON, PickStatus.LOST, PickStatus.PENDING],
                },
              },
              orderBy: { publishedAt: "desc" },
              take: 5,
              select: {
                id: true,
                pickType: true,
                pickValue: true,
                odds: true,
                status: true,
                league: true,
                homeTeam: true,
                awayTeam: true,
              },
            },
          },
        },
      },
    }),

    prisma.tipsterStats.count({
      where: {
        totalPicks: { gte: filters.minPicks },
        user: { isVerified: true, role: $Enums.Role.TIPSTER },
      },
    }),
  ]);

  // Añadir posición en el ranking
  const rankedTipsters = tipsters.map((tipster, index) => ({
    rank: skip + index + 1,
    ...tipster,
  }));

  return NextResponse.json({
    success: true,
    data: {
      tipsters: rankedTipsters,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
        hasMore: filters.page * filters.limit < total,
      },
      meta: {
        orderBy: filters.orderBy,
        minPicks: filters.minPicks,
      },
    },
  });
}
