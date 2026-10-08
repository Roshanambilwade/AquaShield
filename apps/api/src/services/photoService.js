import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "../../../../packages/shared/reportOptions.js";
import { ApiError } from "../middleware/errors.js";

export async function processPhoto(dataUrl) {
  if (!dataUrl) return undefined;
  const [, mime, encoded] =
    dataUrl.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/) || [];
  const invalid = () =>
    new ApiError(
      422,
      "INVALID_PHOTO",
      "Please select a valid JPEG or PNG photo, up to 2 MB.",
      { fields: { photo: "Use a JPEG or PNG up to 2 MB." } },
    );
  if (!encoded) throw invalid();
  const input = Buffer.from(encoded, "base64");
  if (input.length > MAX_PHOTO_BYTES || input.toString("base64") !== encoded)
    throw invalid();
  try {
    const image = sharp(input, {
      limitInputPixels: 16000000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    const format = mime === "image/jpeg" ? "jpeg" : "png";
    if (metadata.format !== format || (metadata.pages || 1) !== 1)
      throw invalid();
    const data = await image
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data, contentType: "image/jpeg" };
  } catch {
    throw invalid();
  }
}
