const multer = require("multer");
const sharp = require("sharp");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});

function uploadError(status, code, message) {
  return Object.assign(new Error(message), { status, code, safe: true });
}

async function validateImage(req, res, next) {
  try {
    if (!req.file)
      throw uploadError(400, "MISSING_FILE", "กรุณาแนบรูปในฟิลด์ slip");
    const { fileTypeFromBuffer } = await import("file-type");
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (
      !type ||
      !["image/jpeg", "image/png", "image/webp"].includes(type.mime)
    ) {
      throw uploadError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "รองรับเฉพาะรูป JPEG PNG และ WebP",
      );
    }
    try {
      // Decode with a pixel limit to reject broken images and excessive dimensions.
      await sharp(req.file.buffer, {
        limitInputPixels: 25000000,
        failOn: "warning",
      }).stats();
    } catch {
      throw uploadError(
        422,
        "INVALID_IMAGE",
        "รูปเสียหาย อ่านไม่ได้ หรือมีขนาดภาพเกิน 25 ล้านพิกเซล",
      );
    }
    req.file.detectedMime = type.mime;
    next();
  } catch (error) {
    next(error);
  }
}

function receiveSlip(req, res, next) {
  if (!req.is("multipart/form-data"))
    return next(
      uploadError(
        415,
        "MULTIPART_REQUIRED",
        "กรุณาส่งเป็น multipart/form-data",
      ),
    );
  upload.single("slip")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE")
      return next(
        uploadError(413, "FILE_TOO_LARGE", "รูปต้องมีขนาดไม่เกิน 4 MB"),
      );
    return next(
      uploadError(
        400,
        "INVALID_UPLOAD",
        "กรุณาส่งไฟล์เดียวในฟิลด์ slip โดยไม่แนบฟิลด์อื่น",
      ),
    );
  });
}
module.exports = { receiveSlip, validateImage };
