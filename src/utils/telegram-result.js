const present = (value) =>
  value == null || value === "" ? "ไม่มีข้อมูล" : String(value);
function formatResult(result, usage) {
  const d = result.data;
  const person = (p) =>
    `${present(p?.name)} · ${present(p?.bank)} · ${present(p?.account)}`;
  let date = present(d.transferDateTime);
  if (
    typeof d.transferDateTime === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(d.transferDateTime) &&
    Number.isFinite(Date.parse(d.transferDateTime))
  ) {
    date =
      new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(d.transferDateTime)) + " (เวลาไทย)";
  }
  const amount =
    d.amount == null
      ? "ไม่มีข้อมูล"
      : new Intl.NumberFormat("th-TH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(d.amount);
  const currency = ["764", "THB"].includes(d.currency)
    ? "บาท"
    : (d.currency ?? "(ไม่ระบุสกุลเงิน)");
  return [
    result.status === "DUPLICATE"
      ? "⚠️ พบประวัติตรวจสลิปซ้ำ"
      : "✅ ตรวจสอบพบธุรกรรม",
    "",
    `📤 ผู้โอน: ${person(d.sender)}`,
    `📥 ผู้รับ: ${person(d.receiver)}`,
    `💰 ยอดเงิน: ${amount} ${d.amount == null ? "" : currency}`,
    `🕒 เวลาโอน: ${date}`,
    `🧾 เลขอ้างอิง: ${present(d.transactionRef)}`,
    "",
    usage
      ? `📊 ใช้ไปแล้ว: ${usage.used} / ${usage.max ?? "ไม่จำกัด"} ครั้ง (โควต้ารวมรอบปัจจุบัน)`
      : "📊 จำนวนใช้งาน: ดึงข้อมูลไม่ได้",
    "ผลตรวจไม่ใช่การยืนยันชำระคำสั่งซื้อ และประวัติตรวจซ้ำไม่ใช่หลักฐานการจ่ายซ้ำ",
  ].join("\n");
}
module.exports = { formatResult };
