import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "@/lib/cloudinary";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    try {
      const userId = authUser.userId;

      if (!userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarPublicId: true },
      });

      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No se ha subido ningún archivo" },
          { status: 400 },
        );
      }

      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "El archivo debe ser una imagen" },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { url, publicId } = await uploadImageToCloudinary(
        buffer,
        "pick_verso/avatars",
      );

      if (currentUser?.avatarPublicId) {
        await deleteImageFromCloudinary(currentUser.avatarPublicId);
      }

      console.log("eeeee", url);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: url,
          avatarPublicId: publicId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatarUrl: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Avatar actualizado correctamente",
          data: { user: updatedUser },
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Error al subir avatar:", error);
      return NextResponse.json(
        { error: "Error interno al procesar la imagen" },
        { status: 500 },
      );
    }
  });
}
