import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    const user = await prisma.user.update({
      where: { id: authUser.userId },
      data: { isActive: false },
      select: { id: true, email: true, username: true },
    });

    return NextResponse.json({
      success: true,
      message: "Cuenta desactivada correctamente",
      data: { user },
    });
  });
}
