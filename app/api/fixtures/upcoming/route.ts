import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getUpcomingFixtures } from "@/lib/api-football";

export async function GET(req: NextRequest) {
  return requireAuth(req, async () => {
    const fixtures = await getUpcomingFixtures();

    // Agrupar por fecha para el selector del tipster
    const byDate = fixtures.reduce<Record<string, typeof fixtures>>(
      (acc, f) => {
        const day = new Date(f.date).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        if (!acc[day]) acc[day] = [];
        acc[day].push(f);
        return acc;
      },
      {},
    );

    return NextResponse.json({
      success: true,
      data: {
        fixtures,
        byDate,
        total: fixtures.length,
      },
    });
  });
}
