import prisma from "@/lib/prisma";
import { getFixtureById } from "@/lib/api-football";
import { requireAuth, requireRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { validatePickInput, PickInput } from "@/lib/pick-validator";
import { $Enums, PickStatus } from "../../../generated/prisma/client";

const STATUS_GROUP_MAP: Record<string, PickStatus[]> = {
  active: [PickStatus.PENDING, PickStatus.LOCKED],
  finished: [PickStatus.WON, PickStatus.LOST, PickStatus.VOID],
};

type StatusGroup = keyof typeof STATUS_GROUP_MAP;

const VALID_SORT = ["latest", "oldest", "odds", "stake"] as const;
type SortBy = (typeof VALID_SORT)[number];

const SORT_MAP: Record<SortBy, object> = {
  latest: { publishedAt: "desc" },
  oldest: { publishedAt: "asc" },
  odds: { odds: "desc" },
  stake: { stake: "desc" },
};

const VALID_SPORTS = ["football", "basketball", "tennis"] as const;
type SportFilter = (typeof VALID_SPORTS)[number];

interface PicksSearchParams {
  tipsterId?: string;
  statusGroup?: StatusGroup;
  sport?: SportFilter;
  minOdds?: number;
  maxOdds?: number;
  league?: string;
  sortBy: SortBy;
  page: number;
  limit: number;
}

// ── POST /api/picks — Publicar pronóstico ────────────────────────────
export async function POST(req: NextRequest) {
  return requireRole(req, $Enums.Role.TIPSTER, async (authUser) => {
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
export async function GET(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    const { searchParams } = new URL(req.url);

    const rawStatusGroup = searchParams.get("statusGroup");
    const rawSport = searchParams.get("sport");
    const rawSortBy = searchParams.get("sortBy") ?? "latest";
    const rawMinOdds = Number(searchParams.get("minOdds"));
    const rawMaxOdds = Number(searchParams.get("maxOdds"));

    const filters: PicksSearchParams = {
      tipsterId: searchParams.get("tipsterId") ?? undefined,
      statusGroup:
        rawStatusGroup && rawStatusGroup in STATUS_GROUP_MAP
          ? (rawStatusGroup as StatusGroup)
          : undefined,
      sport: VALID_SPORTS.includes(rawSport as SportFilter)
        ? (rawSport as SportFilter)
        : undefined,
      minOdds:
        Number.isFinite(rawMinOdds) && rawMinOdds > 0 ? rawMinOdds : undefined,
      maxOdds:
        Number.isFinite(rawMaxOdds) && rawMaxOdds > 0 ? rawMaxOdds : undefined,
      league: searchParams.get("league") ?? undefined,
      sortBy: VALID_SORT.includes(rawSortBy as SortBy)
        ? (rawSortBy as SortBy)
        : "latest",
      page: Math.max(1, Number(searchParams.get("page") ?? "1")),
      limit: Math.min(
        50,
        Math.max(1, Number(searchParams.get("limit") ?? "20")),
      ),
    };

    const skip = (filters.page - 1) * filters.limit;

    const requestingUserId = filters.tipsterId
      ? null
      : (authUser?.userId ?? null);

    const where = {
      // Tipster
      ...(filters.tipsterId && { tipsterId: filters.tipsterId }),

      // Status group → mapea a array de statuses reales
      ...(filters.statusGroup && {
        status: { in: STATUS_GROUP_MAP[filters.statusGroup] },
      }),

      // Sport
      ...(filters.sport && { sport: filters.sport }),

      // Odds range
      ...(filters.minOdds !== undefined || filters.maxOdds !== undefined
        ? {
            odds: {
              ...(filters.minOdds !== undefined && { gte: filters.minOdds }),
              ...(filters.maxOdds !== undefined && { lte: filters.maxOdds }),
            },
          }
        : {}),

      // League
      ...(filters.league && {
        league: { contains: filters.league, mode: "insensitive" as const },
      }),

      // Solo picks de tipsters verificados en el feed global
      ...(!filters.tipsterId && {
        tipster: { isVerified: true },
      }),
    };

    const [picks, total] = await Promise.all([
      prisma.pick.findMany({
        where,
        orderBy: SORT_MAP[filters.sortBy],
        skip,
        take: filters.limit,
        select: {
          id: true,
          matchDate: true,
          league: true,
          sport: true,
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
              isVerified: true,
              stats: {
                select: {
                  yield: true,
                  roi: true,
                  winRate: true,
                  totalPicks: true,
                },
              },
            },
          },
        },
      }),
      prisma.pick.count({ where }),
    ]);

    const picksWithAccess = picks.map((pick) => {
      const isOwner = pick.tipster.id === requestingUserId;
      const isPremiumLocked = pick.isPremium && !isOwner;

      return {
        ...pick,
        odds: Number(pick.odds),
        analysis: isPremiumLocked ? null : pick.analysis,
        isPremiumLocked,
        tipster: {
          ...pick.tipster,
          stats: pick.tipster.stats
            ? {
                yield: Number(pick.tipster.stats.yield),
                roi: Number(pick.tipster.stats.roi),
                winRate: Number(pick.tipster.stats.winRate),
                totalPicks: pick.tipster.stats.totalPicks,
              }
            : null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        picks: picksWithAccess,
        pagination: {
          total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(total / filters.limit),
          hasMore: filters.page * filters.limit < total,
        },
        meta: {
          statusGroup: filters.statusGroup ?? null,
          sport: filters.sport ?? null,
          sortBy: filters.sortBy,
        },
      },
    });
  });
}
