/**
 * ============================================================
 * MOCK CATEGORIES DATA
 * Mock data สำหรับหมวดหมู่สินค้า
 * ============================================================
 */

const MOCK_CATEGORIES = [
  {
    id: 1,
    code: 'fruit',
    name: 'ผลไม้',
    description: 'ผลไม้สดใหม่จากสวนเกษตร',
    icon: 'durian.png',
    image: '/assets/images/durian.png',
    color: '#FF6B6B',
    products: [
      { name: 'ทุเรียน', thaiName: 'ทุเรียน' },
      { name: 'มะม่วง', thaiName: 'มะม่วง' },
      { name: 'กล้วย', thaiName: 'กล้วย' },
      { name: 'น้อยหน่า', thaiName: 'น้อยหน่า' },
      { name: 'สับปะรด', thaiName: 'สับปะรด' },
      { name: 'มะนาว', thaiName: 'มะนาว' }
    ]
  },
  {
    id: 2,
    code: 'vegetable',
    name: 'ผัก',
    description: 'ผักสดใจ จากไร่เกษตร',
    icon: 'leaf',
    image: '/assets/images/vegetable.png',
    color: '#51CF66',
    products: [
      { name: 'พืชผักกาด', thaiName: 'ผักกาด' },
      { name: 'มะเขือ', thaiName: 'มะเขือ' },
      { name: 'อ่อยไทย', thaiName: 'อ่อยไทย' },
      { name: 'กะหล่ำปลี', thaiName: 'กะหล่ำปลี' },
      { name: 'แครอท', thaiName: 'แครอท' },
      { name: 'บีท', thaiName: 'บีท' },
      { name: 'เบอร์', thaiName: 'เบอร์' }
    ]
  },
  {
    id: 3,
    code: 'oil',
    name: 'น้ำมัน',
    description: 'น้ำมันจากพืชการเกษตร',
    icon: 'opacity',
    image: '/assets/images/oil.png',
    color: '#FFD43B',
    products: [
      { name: 'น้ำมันปาล์ม', thaiName: 'น้ำมันปาล์ม' },
      { name: 'น้ำมันมะพร้าว', thaiName: 'น้ำมันมะพร้าว' },
      { name: 'น้ำมันะป้อ', thaiName: 'น้ำมันะป้อ' },
      { name: 'น้ำมันงา', thaiName: 'น้ำมันงา' }
    ]
  },
  {
    id: 4,
    code: 'retail-rice',
    name: 'ข้าว',
    description: 'ข้าวสายพันธุ์ไทย หิมพานต์ แสบปลา',
    icon: 'rice_bowl',
    image: '/assets/images/rice.png',
    color: '#9775FA',
    products: [
      { name: 'ข้าวหิมพานต์', thaiName: 'ข้าวหิมพานต์' },
      { name: 'ข้าวแสบปลา', thaiName: 'ข้าวแสบปลา' },
      { name: 'ข้าวโรงไทย', thaiName: 'ข้าวโรงไทย' },
      { name: 'ข้าวหมัก', thaiName: 'ข้าวหมัก' },
      { name: 'ข้าวหอม', thaiName: 'ข้าวหอม' }
    ]
  },
  {
    id: 5,
    code: 'organic',
    name: 'อินทรีย์',
    description: 'ผลิตภัณฑ์อินทรีย์ที่ปลอดสารพิษ',
    icon: 'eco',
    image: '/assets/images/organic.png',
    color: '#22B14C',
    products: [
      { name: 'ผักอินทรีย์', thaiName: 'ผักอินทรีย์' },
      { name: 'ผลไม้อินทรีย์', thaiName: 'ผลไม้อินทรีย์' },
      { name: 'ไข่ไก่อินทรีย์', thaiName: 'ไข่ไก่อินทรีย์' },
      { name: 'เนื้อสัตว์อินทรีย์', thaiName: 'เนื้อสัตว์อินทรีย์' }
    ]
  },
  {
    id: 6,
    code: 'seedlings',
    name: 'พืชพันธุ์',
    description: 'เมล็ดพันธุ์และตัวอ่อนพืช',
    icon: 'sprout',
    image: '/assets/images/seedlings.png',
    color: '#A9E242',
    products: [
      { name: 'ต้นพืชผัก', thaiName: 'ต้นพืชผัก' },
      { name: 'ต้นลำไม้', thaiName: 'ต้นลำไม้' },
      { name: 'เมล็ดพันธุ์ข้าว', thaiName: 'เมล็ดพันธุ์ข้าว' },
      { name: 'เมล็ดพันธุ์ผัก', thaiName: 'เมล็ดพันธุ์ผัก' },
      { name: 'ท่อนพันธุ์ไม้', thaiName: 'ท่อนพันธุ์ไม้' }
    ]
  }
];

module.exports = MOCK_CATEGORIES;
