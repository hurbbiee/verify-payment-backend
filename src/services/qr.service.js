const sharp = require("sharp");
const jsQR = require("jsqr");

async function readQr(buffer) {
  const { data, info } = await sharp(buffer, { limitInputPixels: 25000000 })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!qr)
    throw Object.assign(
      new Error("ไม่พบ QR ที่อ่านได้ กรุณาใช้รูปที่ QR ชัดเจน"),
      { safe: true, status: 422, code: "QR_NOT_READABLE" },
    );
  return { payload: qr.data, byteLength: qr.binaryData.length, decoded: require("../utils/qr-payload").decodeMiniQr(qr.data), inspection: require("../utils/qr-payload").inspectPayload(qr.data) };
}
module.exports = { readQr };
