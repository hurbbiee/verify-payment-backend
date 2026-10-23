# Thai Bank Slip Verification API

ขั้นที่ 1: โครง Express ด้วย JavaScript CommonJS ยังไม่ได้เชื่อม Thunder หรือเปิดรับรูปสลิป

## เริ่มใช้งาน

ต้องมี Node.js 22 ขึ้นไป และ npm

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

เรียก `GET http://localhost:3000/api/health` ผ่าน Postman โดยเลือก GET และกด Send

```json
{ "success": true, "message": "API is running" }
```

คำสั่ง `npm start` สำหรับรันปกติ และ `npm test` สำหรับทดสอบโดยไม่เรียกบริการเสียเงิน

## โครงสร้างและแนวคิด

- `src/server.js` โหลด .env และเปิดพอร์ต
- `src/app.js` ประกอบ Express และ middleware แยกจากการเปิดพอร์ตเพื่อทดสอบง่าย
- `src/config/env.js` ตรวจค่าตั้งแต่เริ่มโปรแกรม หากผิดจะหยุดก่อนรับคำขอ
- `src/routes/index.js` กำหนด URL ของ API
- `src/middlewares/error.middleware.js` ส่งข้อผิดพลาดรูปแบบเดียวกันโดยไม่เปิดเผย stack trace
- `tests/app.test.js` ทดสอบ HTTP จริงบนพอร์ตชั่วคราว

Middleware คือฟังก์ชันที่ทำงานระหว่างรับ request และตอบ response เช่น Helmet เพิ่ม HTTP headers ส่วน express.json อ่าน JSON ขนาดไม่เกิน 16 KB และ error middleware รับข้อผิดพลาดไปตอบอย่างปลอดภัย

CORS_ORIGIN กำหนดเว็บที่ browser อนุญาตให้อ่าน response ได้ ไม่ใช่ระบบยืนยันตัวตนหรือการป้องกัน client อื่นเรียก API

## ขั้นถัดไป

เพิ่ม multipart/form-data สำหรับส่งรูปในฟิลด์ slip, จำกัดขนาด 5 MB, ตรวจเนื้อไฟล์จริง และ rate limit ก่อนต่อ Controller → Service → Provider

Controller ดูแล HTTP, Service ดูแลกติกาของงาน และ Provider Adapter แปลงการเรียกบริการ Thunder ให้แยกจากส่วนอื่น จากนั้นเพิ่ม mock ที่ระบุว่าเป็นข้อมูลจำลองอย่างชัดเจนและทดสอบ timeout กับข้อผิดพลาด

ยังไม่มี POST /api/slips/verify, การตรวจสลิป, duplicate detection หรือการยืนยันชำระเงิน การตรวจสลิปจริงต้องอ่านเอกสาร Thunder และตั้ง API key ก่อน ส่วนการยืนยันคำสั่งซื้อยังต้องตรวจผู้รับ ยอดเงิน และบริบทการชำระเงินเพิ่มเติม

## ขั้นที่ 2: API รับรูปสลิป

POST /api/slips/verify รับ multipart/form-data ไฟล์เดียวชื่อ slip ไม่รับฟิลด์อื่น
จำกัด 5 MB และ 10 คำขอต่อนาทีต่อ IP ตรวจ signature และถอดรหัสรูป JPEG PNG WebP จริง จำกัด 25 ล้านพิกเซล เก็บใน memory ระหว่างคำขอเท่านั้น

Postman: เลือก POST → Body → form-data → key slip ชนิด File → เลือกรูป → Send ไม่ตั้ง Content-Type เอง

ตอนนี้รูปที่ผ่านการตรวจจะตอบ HTTP 503 พร้อม status UNVERIFIED และ code VERIFICATION_NOT_CONFIGURED เพราะยังไม่เชื่อม Thunder การอ่านรูปสำเร็จไม่ได้หมายความว่าเป็นสลิปจริงหรือโอนเงินจริง

รหัสข้อผิดพลาด: MISSING_FILE (400), INVALID_UPLOAD (400), MULTIPART_REQUIRED (415), UNSUPPORTED_FILE_TYPE (415), FILE_TOO_LARGE (413), INVALID_IMAGE (422), RATE_LIMIT_EXCEEDED (429)

ทดลองจาก Angular ให้เอาเครื่องหมายโหมดตัวอย่างออกก่อนกดตรวจสอบ ใน production ควรเพิ่มขีดจำกัดคำขอรวมที่ reverse proxy และระบบจำกัดอัตราร่วมระหว่างหลาย instance

## เชื่อม Thunder จริง

ใส่ THUNDER_API_KEY ใน backend/.env แล้ว restart backend อย่าใส่ key ใน frontend หรือ commit ไฟล์ .env
ปลายทางถูกตรึงเป็น https://api.thunder.in.th/v2/verify/bank เพื่อไม่ส่ง key ไปปลายทางอื่น ใช้ Bearer authentication ส่งฟิลด์ image และ checkDuplicate=true จำกัดเวลารวม 20 วินาที ไม่มี retry อัตโนมัติเพื่อหลีกเลี่ยงการใช้โควต้าซ้ำ

ปรับขนาดไฟล์ทั้ง frontend/backend เป็น 4 MB ตามข้อกำหนด Thunder แล้ว (แทนข้อความ 5 MB ในส่วนก่อนหน้า)
ตรวจซ้ำหมายถึงประวัติตรวจของ Thunder: branch เดิมอาจใช้ cache ไม่หักโควต้า branch อื่นหักโควต้า ไม่ใช่หลักฐานว่ามีการชำระคำสั่งซื้อซ้ำ และไม่ใช่ระบบ unique transaction ของเรา

ข้อมูลที่ผู้ให้บริการไม่ส่งคืนเป็น null ไม่เติม THB หรือ timezone เอง หน้าเว็บแสดงวันเวลาตามข้อความจาก provider โดยไม่แปลง timezone
เอกสาร: https://document.thunder.in.th/th/v2/verify/bank/image
การทดสอบใช้ HTTP จำลอง ไม่ส่งรูปจริงหรือใช้โควต้า บัญชีผู้ใช้ต้องมี key และโควต้าก่อนทดสอบจริง รองรับสลิปขึ้นกับผู้ให้บริการ ไม่รับประกันทุกธนาคารหรือทุก QR

## อ่าน QR เอง ไม่ใช้ Thunder

POST /api/slips/read-qr ส่ง multipart/form-data ฟิลด์ slip เช่นเดียวกับ verify ไม่ต้องใช้ API key ไม่เรียกบริการภายนอก
ผลตอบกลับ status READ_ONLY, verified false, data.payload เป็นข้อความดิบใน QR ไม่ใช่ผลตรวจธุรกรรม และไม่ใช่ OCR
โหมด development จะ log payload ลง terminal เพื่อทดลองตามคำขอผู้ใช้ production ไม่ log payload เนื่องจากอาจมีข้อมูลส่วนตัว ไม่ได้เก็บรูปถาวร
อ่านได้หนึ่ง QR ต่อคำขอ รูปเบลอหรือ QR เล็กอาจอ่านไม่ได้ ไม่รับประกันรองรับทุกรูปแบบสลิป และไม่เปิด URL ที่พบใน QR
"# verify-payment-backend" 

## Telegram ตรวจรูปจริง

ผู้ใช้ที่อยู่ใน TELEGRAM_ALLOWED_USER_IDS ส่งรูปหรือไฟล์ภาพในแชตส่วนตัวได้ ใช้ pipeline ตรวจไฟล์เดียวกับเว็บก่อนเรียก Thunder และส่งผลพร้อม application quota.used/max (รวมทั้งเว็บและ bot ในรอบบิล ไม่ใช่ยอดส่วนตัวต่อ user)
ไม่เก็บรูปและไม่ log ข้อมูลสลิป ใช้ update_id กันประมวลผลซ้ำใน memory 24 ชั่วโมง และจำกัดหนึ่งงานต่อ user พร้อมกัน การ restart หรือหลาย instance ไม่แชร์สถานะกัน จึงยังไม่รับประกัน exactly-once ควรเพิ่ม persistent queue/dedup ก่อนใช้วงกว้าง
หากส่งผลตอบกลับไม่สำเร็จจะไม่ตรวจใหม่อัตโนมัติ เพื่อป้องกันใช้โควต้าซ้ำ ผู้ใช้สามารถส่งรูปใหม่ด้วยตนเองได้

## Telegram กลุ่ม

รองรับ group และ supergroup เพิ่ม bot แล้วส่ง /chatid@qc_sleep_bot เพื่อดู chat ID (คำสั่งนี้ไม่ตรวจสลิป)
ตั้ง TELEGRAM_ALLOWED_CHAT_IDS เป็น chat ID ที่ได้ รวมเครื่องหมายลบ เช่น -1001234567890 และคง TELEGRAM_ALLOWED_USER_IDS ของสมาชิกที่อนุญาต ต้องผ่านทั้งสองเงื่อนไขก่อนตรวจ
ตั้ง TELEGRAM_BOT_USERNAME=qc_sleep_bot
ส่งรูปพร้อม caption /v@qc_sleep_bot หรือ reply รูปด้วยคำสั่ง /v@qc_sleep_bot ไม่ตรวจรูปในกลุ่มอัตโนมัติ ผลธุรกรรมและโควต้ารวมจะแสดงให้สมาชิกกลุ่มเห็น หากมีการ migrate เป็น supergroup ต้องเพิ่ม chat ID ใหม่
ถ้า bot ไม่ได้รับ caption รูปภายใต้ privacy mode ให้ใช้คำสั่งแบบ reply รูปก่อน หากยังไม่รับให้ตรวจ Privacy Mode กับ BotFather ตามเอกสาร Telegram; โค้ดยังคงตรวจเฉพาะคำสั่ง /verify ไม่ว่าบอตได้รับข้อความอื่นหรือไม่
