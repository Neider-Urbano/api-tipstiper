import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getFixtureById } from "@/lib/api-football";
import { NextRequest, NextResponse } from "next/server";
import { PickStatus } from "../../../generated/prisma/client";
import { validatePickInput, PickInput } from "@/lib/pick-validator";

// ── POST /api/picks — Publicar pronóstico ────────────────────────────
export async function POST(req: NextRequest) {
  return requireRole(req, "TIPSTER", async (authUser) => {
    const body: PickInput = await req.json();

    const {
      matchId,
      matchDate,
      pickType,
      pickValue,
      odds,
      stake,
      isPremium = false,
      analysis,
      league,
      homeTeam,
      awayTeam,
    } = body;

    // Campos obligatorios
    if (
      !matchId ||
      !matchDate ||
      !pickType ||
      !pickValue ||
      !odds ||
      !stake ||
      !league ||
      !homeTeam ||
      !awayTeam
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan campos obligatorios: matchId, matchDate, pickType, pickValue, odds, stake, league, homeTeam, awayTeam",
        },
        { status: 400 },
      );
    }

    // Validar lógica del pick
    const validation = validatePickInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      );
    }

    // Verificar que el partido existe en API-Football
    const fixture = await getFixtureById(Number(matchId));
    if (!fixture) {
      return NextResponse.json(
        {
          success: false,
          error: "El partido no existe en API-Football. Verifica el matchId",
        },
        { status: 404 },
      );
    }

    // Doble verificación: el partido todavía no empezó en la API
    if (fixture.status !== "NS") {
      return NextResponse.json(
        {
          success: false,
          error: `El partido ya está en curso o terminó (status: ${fixture.status})`,
        },
        { status: 400 },
      );
    }

    // Verificar que el tipster no haya publicado ya un pick para este partido
    const duplicate = await prisma.pick.findFirst({
      where: {
        tipsterId: authUser.userId,
        matchId: String(matchId),
        status: { in: [PickStatus.PENDING, PickStatus.LOCKED] },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: "Ya tienes un pick activo para este partido" },
        { status: 409 },
      );
    }

    // Crear el pick — publishedAt lo setea Prisma automáticamente
    const pick = await prisma.pick.create({
      data: {
        tipsterId: authUser.userId,
        matchId: String(matchId),
        matchDate: new Date(matchDate),
        league,
        homeTeam,
        awayTeam,
        pickType,
        pickValue,
        odds,
        stake,
        isPremium,
        analysis: analysis ?? null,
      },
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
        tipster: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pick publicado correctamente",
        data: { pick },
      },
      { status: 201 },
    );
  });
}

// ── GET /api/picks — Listar picks con filtros ────────────────────────
// Query params opcionales:
//   tipsterId  → picks de un tipster específico
//   status     → PENDING | LOCKED | WON | LOST | VOID
//   league     → filtrar por liga
//   page       → paginación (default 1)
//   limit      → resultados por página (default 20, max 50)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tipsterId = searchParams.get("tipsterId") ?? undefined;
  const status = searchParams.get("status") as PickStatus | null;
  const league = searchParams.get("league") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") ?? "20")),
  );
  const skip = (page - 1) * limit;

  // Validar status si viene
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

  // Obtener usuario autenticado si hay token (para mostrar análisis premium)
  const authHeader = req.headers.get("authorization");
  let currentUserId: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyToken } = await import("@/lib/jwt");
      const payload = verifyToken(authHeader.split(" ")[1]);
      currentUserId = payload.userId;
    } catch {
      // Token inválido — tratar como anónimo
    }
  }

  const where = {
    ...(tipsterId && { tipsterId }),
    ...(status && { status }),
    ...(league && {
      league: { contains: league, mode: "insensitive" as const },
    }),
  };

  const [picks, total] = await Promise.all([
    prisma.pick.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
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
        status: true,
        publishedAt: true,
        lockedAt: true,
        // El análisis solo se muestra si:
        // 1. El pick es gratuito, o
        // 2. El usuario es el tipster dueño del pick
        // (la lógica de suscripción se añade en fase 2)
        analysis: true,
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
    }),
    prisma.pick.count({ where }),
  ]);

  // Ocultar análisis premium si el usuario no tiene acceso
  const picksWithAccess = picks.map((pick) => ({
    ...pick,
    analysis:
      pick.isPremium && pick.tipster.id !== currentUserId
        ? null // oculto — en fase 2 verificaremos suscripción
        : pick.analysis,
    isPremiumLocked: pick.isPremium && pick.tipster.id !== currentUserId,
  }));

  return NextResponse.json({
    success: true,
    data: {
      picks: picksWithAccess,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
}
