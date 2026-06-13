import prisma from "@/lib/prisma";
import { $Enums } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

type OrderByField = "yield" | "winRate" | "totalPicks" | "unitsWon";
const VALID_ORDER_FIELDS: OrderByField[] = [
  "yield",
  "winRate",
  "totalPicks",
  "unitsWon",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const orderBy = (searchParams.get("orderBy") ?? "yield") as OrderByField;
  const minPicks = Math.max(1, Number(searchParams.get("minPicks") ?? "10"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") ?? "20")),
  );
  const skip = (page - 1) * limit;

  // Validar campo de ordenamiento
  if (!VALID_ORDER_FIELDS.includes(orderBy)) {
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
        totalPicks: { gte: minPicks },
        user: { isVerified: true, role: $Enums.Role.TIPSTER },
      },
      orderBy: { [orderBy]: "desc" },
      skip,
      take: limit,
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
            // Picks recientes para mostrar actividad
            picks: {
              where: { status: { in: ["WON", "LOST", "PENDING"] } },
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
        totalPicks: { gte: minPicks },
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
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      meta: {
        orderBy,
        minPicks,
      },
    },
  });
}
