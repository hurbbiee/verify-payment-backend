// Structural inspection only. No field is assigned a bank-specific meaning.
function inspectPayload(payload) {
  const bytes = Buffer.from(payload, "utf8");
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const header = bytes.subarray(offset, offset + 4).toString("ascii");
    if (header.length !== 4 || !/^\d{4}$/.test(header))
      return {
        format: "UNKNOWN",
        fields: [],
        note: "ไม่ตรงกับโครงสร้างทดลอง ID 2 หลัก + ความยาว 2 หลัก จึงไม่แปลข้อมูล",
      };
    const length = Number(header.slice(2));
    if (offset + 4 + length > bytes.length)
      return {
        format: "UNKNOWN",
        fields: [],
        note: "ความยาวข้อมูลไม่ตรงกับโครงสร้างทดลอง จึงไม่แปลข้อมูล",
      };
    fields.push({
      id: header.slice(0, 2),
      length,
      value: bytes.subarray(offset + 4, offset + 4 + length).toString("utf8"),
    });
    offset += 4 + length;
  }
  return {
    format: fields.length ? "TLV_CANDIDATE" : "UNKNOWN",
    fields,
    note: "แยกโครงสร้างได้เท่านั้น ยังไม่ยืนยันมาตรฐาน ความหมายของรหัส checksum หรือธุรกรรม ห้ามตีความค่าเป็นยอดหรือชื่อโดยไม่มีสเปก",
  };
}
module.exports = { inspectPayload };

// SCB: extracting-data-from-mini-qr.pdf. This identifies a structure, not a transaction.
function crc16(value) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function decodeMiniQr(payload) {
  const outer = inspectPayload(payload);
  const find = (fields, id) => fields.find((field) => field.id === id)?.value;
  const ids = outer.fields.map((field) => field.id);
  if (outer.format !== "TLV_CANDIDATE" || new Set(ids).size !== ids.length)
    return null;
  const nested = inspectPayload(find(outer.fields, "00") ?? "");
  const apiId = find(nested.fields, "00");
  const sendingBankCode = find(nested.fields, "01");
  const transactionRef = find(nested.fields, "02");
  if (
    nested.format !== "TLV_CANDIDATE" ||
    new Set(nested.fields.map((f) => f.id)).size !== nested.fields.length ||
    apiId !== "000001" ||
    !/^\d{3}$/.test(sendingBankCode ?? "") ||
    !transactionRef ||
    Buffer.byteLength(transactionRef) > 25 ||
    find(outer.fields, "51") !== "TH"
  )
    return null;
  const last = outer.fields.at(-1);
  const checksum =
    last?.id === "91" && last.length === 4 && /^[0-9a-f]{4}$/i.test(last.value)
      ? {
          provided: last.value,
          calculated: crc16(payload.slice(0, -4)),
          valid: last.value.toUpperCase() === crc16(payload.slice(0, -4)),
        }
      : null;
  return {
    format: "MINI_QR_SCB_DOCUMENTED_STRUCTURE",
    apiId,
    sendingBankCode,
    transactionRef,
    countryCode: "TH",
    checksum,
    amount: null,
    senderName: null,
    receiverName: null,
    transferDateTime: null,
    note: "ข้อมูลอ้างอิงจาก QR ไม่ใช่ผลยืนยันธุรกรรม CRC ผ่านก็ไม่ได้ยืนยันว่าเงินโอนจริง รองรับเฉพาะรูปแบบที่ตรงกับสเปกนี้",
  };
}
module.exports.decodeMiniQr = decodeMiniQr;
module.exports.crc16 = crc16;
