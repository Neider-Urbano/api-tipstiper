import { requireAuth } from "@/lib/auth";
import { searchFixtures } from "@/lib/api-football";
import { NextRequest, NextResponse } from "next/server";

interface FilterSearchParams {
  q: string;
  date?: string;
}

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const filters: FilterSearchParams = {
      q: searchParams.get("q")?.trim() ?? "",
      date: searchParams.get("date") ?? undefined,
    };

    if (!filters.q || filters.q.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "El parámetro 'q' debe tener al menos 2 caracteres",
        },
        { status: 400 },
      );
    }

    // Validar formato de fecha si viene
    if (filters.date && !/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
      return NextResponse.json(
        { success: false, error: "Formato de fecha inválido. Usa YYYY-MM-DD" },
        { status: 400 },
      );
    }

    try {
      const fixtures = await searchFixtures(filters.q, filters.date);

      return NextResponse.json({
        success: true,
        data: {
          fixtures,
          total: fixtures.length,
          query: filters.q,
        },
      });
    } catch (error) {
      console.error("Error en searchFixtures:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Error interno del servidor",
        },
        { status: 500 },
      );
    }
  });
}
