# DIT Candidate Mapping

Auto-scan source: `https://pricelist.dit.go.th/main_price.php`

## Home category candidates

### ผลไม้
- DIT group: `W14000`
- Confidence: high
- Sample products:
  - `W14021` ทุเรียนหมอนทอง
  - `W14020` ทุเรียนชะนี
  - `W14022` มังคุด (ผิวมัน)
  - `W14023` มังคุด (ผิวกระ)
  - `W14030` ลองกอง
  - `W14019` เงาะโรงเรียน
  - `W14024` / `W14025` มะม่วงน้ำดอกไม้
  - `W14026` / `W14027` มะม่วงเขียวเสวย

### ผักสด
- DIT group: `W13000`
- Confidence: high
- Sample products:
  - `W13001` ผักคะน้า
  - `W13002` ผักบุ้งจีน
  - `W13005` ผักกาดขาว (ลุ้ย)
  - `W13006` กะหล่ำปลี
  - `W13012` ถั่วฝักยาว
  - `W13013` แตงกวา
  - `W13020` พริกสดชี้ฟ้า (แดง)

### ข้าว/พืชไร่
- DIT group candidates:
  - `R11000` ราคาขายส่งข้าว ผลิตภัณฑ์ข้าวและกระสอบป่าน
  - `R12000` ราคาขายส่งข้าวสารให้ร้านขายปลีก
- Confidence: high for rice, medium for broad crop coverage
- Sample rice products:
  - `R11001` ข้าวขาว 100% ชั้น 1
  - `R11007` ข้าวขาว 5%
  - `R11029` ข้าวหอมมะลิ 100% ชั้น 1
  - `R12003` ข้าวสารเจ้า 100%
  - `R12007` ข้าวสารเหนียว สันป่าตอง (เขี้ยวงู) 100%

### น้ำมัน
- DIT group: `W18000`
- Confidence: high
- Sample products:
  - `W18001` ผลปาล์มทะลาย คุณภาพเปอร์เซ็นต์น้ำมัน (18%)
  - `W18086` ผลปาล์มทะลาย คุณภาพเปอร์เซ็นต์น้ำมัน (18%)
  - `W18087` ผลปาล์มทะลาย คุณภาพเปอร์เซ็นต์น้ำมัน (18%) จ.กระบี่
  - `W18106` น้ำมันปาล์มสำเร็จรูป บรรจุขวด 1 ลิตร ...
  - `W18107` น้ำมันทานตะวันสำเร็จรูป บรรจุขวด (12 ขวด/หีบ) ตรากุ๊ก

## Not yet matched from Home

- `อินทรีย์` — no clear DIT top-level category on the scanned page
- `พืชพันธุ์` — no direct DIT top-level category; likely needs special handling or may map to a mix of product groups

## Notes

- The scan was done automatically from the DIT dropdowns, so the group/product IDs above are real values from the site.
- Before updating `COMMODITIES`, confirm which categories should be included in the app UI and whether `อินทรีย์` / `พืชพันธุ์` should remain hidden or map to a broader DIT set.