import { requireAuth } from "@/lib/auth";
import { searchFixtures } from "@/lib/api-football";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const date = searchParams.get("date") ?? undefined;

    if (!q || q.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "El parámetro 'q' debe tener al menos 2 caracteres",
        },
        { status: 400 },
      );
    }

    // Validar formato de fecha si viene
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: "Formato de fecha inválido. Usa YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const fixtures = await searchFixtures(q, date);

    return NextResponse.json({
      success: true,
      data: {
        fixtures,
        total: fixtures.length,
        query: q,
      },
    });
  });
}
