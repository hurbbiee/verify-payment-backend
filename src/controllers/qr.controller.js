const { readQr } = require("../services/qr.service");
async function readSlipQr(req, res, next) {
  try {
    const data = await readQr(req.file.buffer);
    // Explicit local debugging only; JSON escaping prevents terminal control injection.
    if (process.env.NODE_ENV !== "production") {
      console.log("[slip QR: NOT VERIFIED]", JSON.stringify(data));
    }
    res.json({
      success: true,
      status: "READ_ONLY",
      verified: false,
      data,
      message:
        "อ่านข้อความใน QR เท่านั้น ยังไม่ได้ตรวจธุรกรรมหรืออ่านข้อความบนรูป",
    });
  } catch (error) {
    next(error);
  }
}
module.exports = { readSlipQr };
