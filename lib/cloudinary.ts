import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  folder: string = "pick_verso/avatars",
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          // Opcional: recortar automáticamente la imagen a un cuadrado perfecto para avatar
          transformation: [
            { width: 500, height: 500, crop: "fill", gravity: "face" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      )
      .end(fileBuffer);
  });
}

export async function deleteImageFromCloudinary(
  publicId: string,
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error borrando imagen de Cloudinary:", error);
  }
}
