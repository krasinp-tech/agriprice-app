// TABLE: profiles
// uuid (PK), phone, first_name, last_name, role
window.mockProfiles = [
  // Farmer profiles (id 1-2)
  {
    id: 1,
    name: "สมชาย เกษตรกร",
    role: "farmer",
    phone: "0812345678",
    email: "farmer1@email.com",
    birthdate: "1980-05-12",
    password: "farmerpass",
    avatar_url: "assets/images/farmer1.jpg",
    addressBook: [
      { label: "บ้าน", address: "123 หมู่ 4 ต.ทุ่งทอง อ.เมือง จ.ชัยภูมิ" },
      { label: "สวน", address: "456 หมู่ 7 ต.ทุ่งทอง อ.เมือง จ.ชัยภูมิ" }
    ],
    deviceAddress: {
      lat: 13.1045,
      lng: 99.9446,
      address: "เพชรบุรี"
    },
    favorites: [101, 102],
    followers: [3, 2],  
    following: [4],
    favoritesFarms: [401, 402],
    followersFarms: [501],
    followingFarms: [601],
  },
  {
    id: 2,                
    name: "สมปอง เกษตรกร",
    role: "farmer",
    phone: "0823456789",
    email: "farmer2@email.com",
    birthdate: "1985-07-19",
    password: "farmerpass2",
    avatar_url: "assets/images/farmer2.jpg",
    addressBook: [
      { label: "บ้าน", address: "321 หมู่ 5 ต.ทุ่งทอง อ.เมือง จ.ชัยภูมิ" }
    ],
    deviceAddress: {
      lat: 10.4931,
      lng: 99.1800,
      address: "ชุมพร"
    },
    favorites: [105],
    followers: [3],      
    following: [1],
    favoritesFarms: [403],
    followersFarms: [],
    followingFarms: [601],
  },
  // Buyer profiles (id 3-9)
  {
    id: 3,               
    name: "สมหญิง ผู้ซื้อ",
    role: "buyer",
    phone: "0898765432",
    email: "buyer1@email.com",
    birthdate: "1992-11-23",
    password: "buyerpass",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [
      { label: "บ้าน", address: "789 หมู่ 2 ต.ทุ่งทอง อ.เมือง จ.ชัยภูมิ" }
    ],
    deviceAddress: {
      lat: 11.8106,
      lng: 99.7977,
      address: "ประจวบคีรีขันธ์"
    },
    favorites: [103, 104],
    followers: [1],
    following: [2],     
    mapUrl: "https://maps.google.com/?q=15.54321,101.54321",
    services: ["ขนส่ง", "ชำระเงินปลายทาง"],
  },
  {
    id: 4,
    name: "สมศรี ผู้ซื้อ",
    role: "buyer",
    phone: "0876543210",
    email: "buyer2@email.com",
    birthdate: "1995-03-15",
    password: "buyerpass2",
    avatar_url: "assets/images/buyer2.jpg",
    addressBook: [
      { label: "บ้าน", address: "654 หมู่ 1 ต.ทุ่งทอง อ.เมือง จ.ชัยภูมิ" }
    ],
    deviceAddress: {
      lat: 12.5700,
      lng: 99.9577,
      address: "หัวหิน ประจวบคีรีขันธ์"
    },
    favorites: [106],
    followers: [2],     
    following: [1],
    mapUrl: "https://maps.google.com/?q=15.98765,101.98765",
    services: ["บริการส่งด่วน"],
  },
  {
    id: 5,
    name: "ผู้ซื้อ3",
    role: "buyer",
    phone: "088000003",
    email: "buyer3@email.com",
    birthdate: "1990-01-03",
    password: "buyerpass3",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [ { label: "บ้าน", address: "บ้านผู้ซื้อ3" } ],
    deviceAddress: { lat: 13.0, lng: 100.0, address: "จังหวัด3" },
    favorites: [], followers: [], following: [],
    mapUrl: "https://maps.google.com/?q=13.3,100.3",
    services: ["ขนส่ง"],
  },
  {
    id: 6,
    name: "ผู้ซื้อ4",
    role: "buyer",
    phone: "088000004",
    email: "buyer4@email.com",
    birthdate: "1990-01-04",
    password: "buyerpass4",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [ { label: "บ้าน", address: "บ้านผู้ซื้อ4" } ],
    deviceAddress: { lat: 14.0, lng: 101.0, address: "จังหวัด4" },
    favorites: [], followers: [], following: [],
    mapUrl: "https://maps.google.com/?q=14.4,101.4",
    services: ["ขนส่ง"],
  },
  {
    id: 7,
    name: "ผู้ซื้อ5",
    role: "buyer",
    phone: "088000005",
    email: "buyer5@email.com",
    birthdate: "1990-01-05",
    password: "buyerpass5",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [ { label: "บ้าน", address: "บ้านผู้ซื้อ5" } ],
    deviceAddress: { lat: 15.0, lng: 102.0, address: "จังหวัด5" },
    favorites: [], followers: [], following: [],
    mapUrl: "https://maps.google.com/?q=15.5,102.5",
    services: ["ขนส่ง"],
  },
  {
    id: 8,
    name: "ผู้ซื้อ6",
    role: "buyer",
    phone: "088000006",
    email: "buyer6@email.com",
    birthdate: "1990-01-06",
    password: "buyerpass6",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [ { label: "บ้าน", address: "บ้านผู้ซื้อ6" } ],
    deviceAddress: { lat: 16.0, lng: 103.0, address: "จังหวัด6" },
    favorites: [], followers: [], following: [],
    mapUrl: "https://maps.google.com/?q=16.6,103.6",
    services: ["ขนส่ง"],
  },
  {
    id: 9,
    name: "ผู้ซื้อ7",
    role: "buyer",
    phone: "088000007",
    email: "buyer7@email.com",
    birthdate: "1990-01-07",
    password: "buyerpass7",
    avatar_url: "assets/images/buyer1.jpg",
    addressBook: [ { label: "บ้าน", address: "บ้านผู้ซื้อ7" } ],
    deviceAddress: { lat: 17.0, lng: 104.0, address: "จังหวัด7" },
    favorites: [], followers: [], following: [],
    mapUrl: "https://maps.google.com/?q=17.7,104.7",
    services: ["ขนส่ง"],
  },
];

// TABLE: varieties
window.mockVarieties = [
  { variety_id: 1, product_name: "ทุเรียน", variety: "หมอนทอง" },
  { variety_id: 2, product_name: "ทุเรียน", variety: "ชะนี" },
  { variety_id: 3, product_name: "ทุเรียน", variety: "กระดุม" },
  { variety_id: 4, product_name: "ลองกอง", variety: "ลองกอง (คละ)" },
  { variety_id: 5, product_name: "มังคุด", variety: "มังคุด (คละ)" },
  { variety_id: 6, product_name: "เงาะ", variety: "โรงเรียน" },
  { variety_id: 7, product_name: "เงาะ", variety: "สีทอง" },
  { variety_id: 8, product_name: "ปาล์ม", variety: "ปาล์มน้อย (คละ)" },
  { variety_id: 9, product_name: "ปาล์ม", variety: "ปาล์มใหญ่ (คละ)" },
  { variety_id: 10, product_name: "ยางพารา", variety: "แผ่นสด (คละ)" },
  { variety_id: 11, product_name: "ยางพารา", variety: "หนึ่งน้อย (คละ)" },
  { variety_id: 12, product_name: "ผักสด", variety: "กะหล่ำปลี" },
  { variety_id: 13, product_name: "ผักสด", variety: "แตงสด" },
  { variety_id: 14, product_name: "ผักสด", variety: "มะเขือเทศ" },
  { variety_id: 15, product_name: "เมล็ดพันธุ์", variety: "ข้าวโพด" },
  { variety_id: 16, product_name: "เมล็ดพันธุ์", variety: "สุข (คละ)" },
  { variety_id: 17, product_name: "ไม้ประดับ", variety: "กุหลาบสามารถ" },
  { variety_id: 18, product_name: "ไม้ประดับ", variety: "ฟลอก์ซ์" }
];

// TABLE: product_slots
// id เริ่มที่ 1 | buyer_id ใช้ id ใหม่ (3-9)
window.mockProductSlots = [
  // --- buyer_id: 3 (สมหญิง) ---
  {
    id: 1,             
    variety_id: 5,
    grades: [
      { grade: "A", price: 130 },
      { grade: "B", price: 110 },
      { grade: "C", price: 90 }
    ],
    start_date: "2026-03-22",
    end_date: "2026-03-29",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 3,       
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-18T12:00:00"
  },
 
  {
    id: 2,            
    variety_id: 6,
    grades: [
      { grade: "A", price: 140 },
      { grade: "B", price: 120 },
      { grade: "C", price: 100 }
    ],
    start_date: "2026-03-18",
    end_date: "2026-03-25",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 3,
    
    buyer_img: "assets/images/buyer2.jpg",
    status: "active",
    updated_at: "2026-03-18T13:00:00"
  },
  {
    id: 3,            
    variety_id: 7,
    grades: [
      { grade: "A", price: 150 },
      { grade: "B", price: 130 },
      { grade: "C", price: 110 }
    ],
    start_date: "2026-03-19",
    end_date: "2026-03-26",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 3,
    
    buyer_img: "assets/images/buyer2.jpg",
    status: "active",
    updated_at: "2026-03-18T14:00:00"
  },
  {
    id: 4,             // เดิม id: 8
    variety_id: 8,
    grades: [
      { grade: "A", price: 155 },
      { grade: "B", price: 135 },
      { grade: "C", price: 115 }
    ],
    start_date: "2026-03-20",
    end_date: "2026-03-27",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 3,
   
    buyer_img: "assets/images/buyer2.jpg",
    status: "active",
    updated_at: "2026-03-18T15:00:00"
  },
  {
    id: 5,             // เดิม id: 9
    variety_id: 9,
    grades: [
      { grade: "A", price: 160 },
      { grade: "B", price: 140 },
      { grade: "C", price: 120 }
    ],
    start_date: "2026-03-21",
    end_date: "2026-03-28",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 3,
    
    buyer_img: "assets/images/buyer2.jpg",
    status: "active",
    updated_at: "2026-03-18T16:00:00"
  },
  {
    id: 6,             // เดิม id: 10
    variety_id: 10,
    grades: [
      { grade: "A", price: 165 },
      { grade: "B", price: 145 },
      { grade: "C", price: 125 }
    ],
    start_date: "2026-03-22",
    end_date: "2026-03-29",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 4,
    
    buyer_img: "assets/images/buyer2.jpg",
    status: "active",
    updated_at: "2026-03-18T17:00:00"
  },
  {
    id: 7,             // เดิม id: 11
    variety_id: 11,
    grades: [
      { grade: "A", price: 170 },
      { grade: "B", price: 150 },
      { grade: "C", price: 130 }
    ],
    start_date: "2026-03-18",
    end_date: "2026-03-25",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 4,
    
    buyer_img: "assets/images/buyer3.jpg",
    status: "active",
    updated_at: "2026-03-18T18:00:00"
  },
  {
    id: 8,             // เดิม id: 12
    variety_id: 12,
    grades: [
      { grade: "A", price: 120 },
      { grade: "B", price: 100 },
      { grade: "C", price: 80 }
    ],
    start_date: "2026-03-19",
    end_date: "2026-03-26",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 4,
    
    buyer_img: "assets/images/buyer3.jpg",
    status: "active",
    updated_at: "2026-03-18T19:00:00"
  },
  {
    id: 9,             // เดิม id: 13
    variety_id: 13,
    grades: [
      { grade: "A", price: 130 },
      { grade: "B", price: 110 },
      { grade: "C", price: 90 }
    ],
    start_date: "2026-03-20",
    end_date: "2026-03-27",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 4,
    
    buyer_img: "assets/images/buyer3.jpg",
    status: "active",
    updated_at: "2026-03-18T20:00:00"
  },
  {
    id: 10,            
    variety_id: 14,
    grades: [
      { grade: "A", price: 140 },
      { grade: "B", price: 120 },
      { grade: "C", price: 100 }
    ],
    start_date: "2026-03-21",
    end_date: "2026-03-28",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 5,
    
    buyer_img: "assets/images/buyer3.jpg",
    status: "active",
    updated_at: "2026-03-18T21:00:00"
  },
  {
    id: 11,            // เดิม id: 15
    variety_id: 15,
    grades: [
      { grade: "A", price: 150 },
      { grade: "B", price: 130 },
      { grade: "C", price: 110 }
    ],
    start_date: "2026-03-22",
    end_date: "2026-03-29",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 5,
    
    buyer_img: "assets/images/buyer4.jpg",
    status: "active",
    updated_at: "2026-03-18T22:00:00"
  },
  // --- buyer_id: 5 (ผู้ซื้อ3) ---
  {
    id: 12,            // เดิม id: 16
    variety_id: 16,
    grades: [
      { grade: "A", price: 160 },
      { grade: "B", price: 140 },
      { grade: "C", price: 120 }
    ],
    start_date: "2026-03-18",
    end_date: "2026-03-25",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 5,
    
    buyer_img: "assets/images/buyer4.jpg",
    status: "active",
    updated_at: "2026-03-18T23:00:00"
  },
  {
    id: 13,            // เดิม id: 17
    variety_id: 17,
    grades: [
      { grade: "A", price: 170 },
      { grade: "B", price: 150 },
      { grade: "C", price: 130 }
    ],
    start_date: "2026-03-19",
    end_date: "2026-03-26",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 6,
    
    buyer_img: "assets/images/buyer4.jpg",
    status: "active",
    updated_at: "2026-03-19T00:00:00"
  },
  {
    id: 14,            // เดิม id: 18
    variety_id: 18,
    grades: [
      { grade: "A", price: 180 },
      { grade: "B", price: 160 },
      { grade: "C", price: 140 }
    ],
    start_date: "2026-03-20",
    end_date: "2026-03-27",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 6,
    
    buyer_img: "assets/images/buyer4.jpg",
    status: "active",
    updated_at: "2026-03-19T01:00:00"
  },
  {
    id: 15,            // เดิม id: 19
    variety_id: 3,
    grades: [
      { grade: "A", price: 150 },
      { grade: "B", price: 130 },
      { grade: "C", price: 110 }
    ],
    start_date: "2026-03-19",
    end_date: "2026-03-26",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 6,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-19T02:00:00"
  },
  {
    id: 16,            // เดิม id: 24
    variety_id: 2,
    grades: [
      { grade: "A", price: 140 },
      { grade: "B", price: 120 },
      { grade: "C", price: 100 }
    ],
    start_date: "2026-03-24",
    end_date: "2026-03-31",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 7,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-24T07:00:00"
  },
  // --- buyer_id: 6 (ผู้ซื้อ4) ---
  {
    id: 17,            // เดิม id: 20
    variety_id: 7,
    grades: [
      { grade: "A", price: 160 },
      { grade: "B", price: 140 },
      { grade: "C", price: 120 }
    ],
    start_date: "2026-03-20",
    end_date: "2026-03-27",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 7,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-20T03:00:00"
  },
  {
    id: 18,            // เดิม id: 25
    variety_id: 5,
    grades: [
      { grade: "A", price: 145 },
      { grade: "B", price: 125 },
      { grade: "C", price: 105 }
    ],
    start_date: "2026-03-25",
    end_date: "2026-04-01",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 7,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-25T08:00:00"
  },
  // --- buyer_id: 7 (ผู้ซื้อ5) ---
  {
    id: 19,            // เดิม id: 21
    variety_id: 12,
    grades: [
      { grade: "A", price: 170 },
      { grade: "B", price: 150 },
      { grade: "C", price: 130 }
    ],
    start_date: "2026-03-21",
    end_date: "2026-03-28",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 7,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-21T04:00:00"
  },
  // --- buyer_id: 8 (ผู้ซื้อ6) ---
  {
    id: 20,            // เดิม id: 22
    variety_id: 15,
    grades: [
      { grade: "A", price: 180 },
      { grade: "B", price: 160 },
      { grade: "C", price: 140 }
    ],
    start_date: "2026-03-22",
    end_date: "2026-03-29",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 8,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-22T05:00:00"
  },
  // --- buyer_id: 9 (ผู้ซื้อ7) ---
  {
    id: 21,            // เดิม id: 23
    variety_id: 18,
    grades: [
      { grade: "A", price: 190 },
      { grade: "B", price: 170 },
      { grade: "C", price: 150 }
    ],
    start_date: "2026-03-23",
    end_date: "2026-03-30",
    rounds: [
      { name: "รอบที่1", time_start: "08:00", time_end: "09:00", capacity: 5, enabled: true },
      { name: "รอบที่2", time_start: "09:00", time_end: "10:00", capacity: 5, enabled: true },
      { name: "รอบที่3", time_start: "10:00", time_end: "11:00", capacity: 5, enabled: true },
      { name: "รอบที่4", time_start: "11:00", time_end: "12:00", capacity: 5, enabled: true },
      { name: "รอบที่5", time_start: "13:00", time_end: "14:00", capacity: 5, enabled: true }
    ],
    buyer_id: 9,
    
    buyer_img: "assets/images/buyer1.jpg",
    status: "active",
    updated_at: "2026-03-23T06:00:00"
  },
];


// TABLE: bookings
// id (PK), booking_no, buyer_id (FK), farmer_id (FK), product_id (FK), slot_id (FK), queue_no, scheduled_time, status, created_at, vehicles, notes
window.mockBookings = [
  // ตัวอย่าง: 2 คิวแรกของ slot_id 1 (ล้งสิงคองพันธุ์ไทย888)
  {
    id: 1,
    booking_no: "BK2603180001",
    buyer_id: "u2",
    farmer_id: "u1",
    slot_id: 1,
    product_slot_id: 1,
    queue_no: "A-001",
    scheduled_time: "2026-03-18T08:00:00",
    status: "waiting",
    created_at: "2026-03-17T10:00:00",
    vehicles: [ { slot: 1, plate: "กด5485", type: "รถบรรทุก 10ล้อ" } ],
    notes: "รับ 8,000 กก.",
    eta_minutes: 0
  },
  {
    id: 2,
    booking_no: "BK2603180002",
    buyer_id: "u3",
    farmer_id: "u1",
    slot_id: 1,
    product_slot_id: 1,
    queue_no: "A-002",
    scheduled_time: "2026-03-18T08:30:00",
    status: "waiting",
    created_at: "2026-03-17T10:10:00",
    vehicles: [ { slot: 1, plate: "กข1234", type: "รถบรรทุก 6ล้อ" } ],
    notes: "รับ 2,500 กก.",
    eta_minutes: 30
  },
  // ตัวอย่าง: 1 คิว slot_id 2 (ล้งสิงคองพันธุ์ไทย888)
  {
    id: 3,
    booking_no: "BK2603180003",
    buyer_id: "u4",
    farmer_id: "u1",
    slot_id: 2,
    product_slot_id: 2,
    queue_no: "B-001",
    scheduled_time: "2026-03-19T09:00:00",
    status: "waiting",
    created_at: "2026-03-18T09:00:00",
    vehicles: [ { slot: 1, plate: "กข5678", type: "รถตู้ 4ล้อ" } ],
    notes: "รับ 1,200 กก.",
    eta_minutes: 0
  },
  // ตัวอย่าง: 2 คิว slot_id 6 (ล้งมังคุดทอง)
  {
    id: 4,
    booking_no: "BK2603180004",
    buyer_id: "u1",
    farmer_id: "u2",
    slot_id: 6,
    product_slot_id: 6,
    queue_no: "C-001",
    scheduled_time: "2026-03-18T13:00:00",
    status: "waiting",
    created_at: "2026-03-17T13:00:00",
    vehicles: [ { slot: 1, plate: "กค9456", type: "รถบรรทุก 10ล้อ" } ],
    notes: "รับ 5,000 กก.",
    eta_minutes: 0
  },
  {
    id: 5,
    booking_no: "BK2603180005",
    buyer_id: "u3",
    farmer_id: "u2",
    slot_id: 6,
    product_slot_id: 6,
    queue_no: "C-002",
    scheduled_time: "2026-03-18T13:30:00",
    status: "waiting",
    created_at: "2026-03-17T13:10:00",
    vehicles: [ { slot: 1, plate: "กง7890", type: "รถบรรทุก 6ล้อ" } ],
    notes: "รับ 3,000 กก.",
    eta_minutes: 30
  }
];

// ฟังก์ชันช่วย: สร้าง booking_no, queue_no, และ ETA อัตโนมัติ
window.createMockBooking = function({buyer_id, farmer_id, slot_id, scheduled_time, vehicles, notes}) {
  // หา slot
  const slot = window.mockProductSlots.find(s => s.id === slot_id);
  if (!slot) throw new Error("ไม่พบ slot");
  // หา bookings เดิมใน slot เดียวกัน
  const bookingsInSlot = window.mockBookings.filter(b => b.slot_id === slot_id);
  // queue_no: A-001, A-002 ... (A = slot_id, หรือใช้ตัวอักษรตาม slot index)
  const slotChar = String.fromCharCode(65 + ((slot_id-1)%26));
  const queueNum = bookingsInSlot.length + 1;
  const queue_no = `${slotChar}-${String(queueNum).padStart(3, "0")}`;
  // booking_no: BK+วันที่+รหัสสุ่ม
  const today = new Date();
  const y = today.getFullYear().toString().slice(-2);
  const m = String(today.getMonth()+1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random()*10000)).padStart(4, "0");
  const booking_no = `BK${y}${m}${d}${rand}`;
  // ETA: 30 นาทีต่อคิว
  const eta_minutes = (queueNum-1)*30;
  // สร้าง booking object
  const booking = {
    id: window.mockBookings.length+1,
    booking_no,
    buyer_id,
    farmer_id,
    slot_id,
    product_slot_id: slot_id,
    queue_no,
    scheduled_time,
    status: "waiting",
    created_at: today.toISOString(),
    vehicles: vehicles || [],
    notes: notes || "",
    eta_minutes
  };
  window.mockBookings.push(booking);
  return booking;
};

// TABLE: chat_rooms
// id (PK), user1_id (FK), user2_id (FK)
window.mockChatRooms = [
  { id: 1, user1_id: "u2", user2_id: "u1" }, // buyer <-> farmer
  { id: 2, user1_id: "u3", user2_id: "u1" },
  { id: 3, user1_id: "u3", user2_id: "u4" },
];

// TABLE: chat_messages (ERD + UI fields)
// id (PK), room_id (FK), sender_id (FK), message, is_read, time, content_type, image_url, status
window.mockChatMessages = [
  // room 1: u2 <-> u1
  { id: 1, room_id: 1, sender_id: "u2", message: "สวัสดีครับ รับซื้อทุเรียนหมอนทองครับ", is_read: true, time: "2026-03-18T08:00:00", content_type: "text", status: "read" },
  { id: 2, room_id: 1, sender_id: "u1", message: "มีผลผลิตประมาณ 800 กก. สนใจไหมครับ", is_read: true, time: "2026-03-18T08:01:00", content_type: "text", status: "read" },
  { id: 3, room_id: 1, sender_id: "u1", message: "รับซื้อวันนี้ได้ครับ ส่งรูปขนาดผลไม้หน่อย", is_read: false, time: "2026-03-18T08:02:00", content_type: "text", status: "sent" },
  { id: 4, room_id: 1, sender_id: "u2", message: "นี่ครับรูปผลไม้ที่ส่งได้วันนี้", is_read: false, time: "2026-03-18T08:03:00", content_type: "text", status: "sent" },
  { id: 5, room_id: 1, sender_id: "u2", message: "", is_read: false, time: "2026-03-18T08:03:10", content_type: "image", image_url: "assets/images/fruit_sample1.jpg", status: "sent" },

  // room 2: u3 <-> u1
  { id: 6, room_id: 2, sender_id: "u3", message: "ทักครับ ขอราคาวันนี้หน่อย", is_read: true, time: "2026-03-18T09:00:00", content_type: "text", status: "read" },
  { id: 7, room_id: 2, sender_id: "u1", message: "ราคาวันนี้ A 180 นะครับ", is_read: true, time: "2026-03-18T09:01:00", content_type: "text", status: "read" },
  { id: 8, room_id: 2, sender_id: "u3", message: "ขอรูปตัวอย่างผลไม้ด้วยครับ", is_read: false, time: "2026-03-18T09:02:00", content_type: "text", status: "sent" },
  { id: 9, room_id: 2, sender_id: "u1", message: "", is_read: false, time: "2026-03-18T09:02:10", content_type: "image", image_url: "assets/images/fruit_sample2.jpg", status: "sent" },

  // room 3: u3 <-> u4
  { id: 10, room_id: 3, sender_id: "u3", message: "มีมังคุดไหมครับ เกรด A/B", is_read: true, time: "2026-03-18T10:00:00", content_type: "text", status: "read" },
  { id: 11, room_id: 3, sender_id: "u4", message: "มีครับ พรุ่งนี้พร้อมส่ง", is_read: true, time: "2026-03-18T10:01:00", content_type: "text", status: "read" },
  { id: 12, room_id: 3, sender_id: "u3", message: "พรุ่งนี้เช้าเข้ารับได้ไหมครับ", is_read: false, time: "2026-03-18T10:02:00", content_type: "text", status: "sent" },
  { id: 13, room_id: 3, sender_id: "u4", message: "ได้ครับ ส่ง location มาด้วยนะครับ", is_read: false, time: "2026-03-18T10:03:00", content_type: "text", status: "sent" },
];

// TABLE: notifications
// id (PK), user_id (FK), type, title, is_read
window.mockNotifications = [
  { id: 1, user_id: "u2", type: "booking", title: "จองสำเร็จ: BK2602191266-E-844", is_read: false },
  { id: 2, user_id: "u1", type: "chat", title: "มีข้อความใหม่จาก นายทองดี ใจงาม", is_read: false },
  { id: 3, user_id: "u3", type: "booking", title: "จองสำเร็จ: BK2602191267-E-845", is_read: true },
  { id: 4, user_id: "u4", type: "chat", title: "มีข้อความใหม่จาก มะลิ ใจดี", is_read: true },
];

// BOOKINGS API (for compatibility)
window.getMockupBookings = function() {
  // Join bookings with profiles, products, slots for display
  return window.mockBookings.map(b => {
    const buyer = window.mockProfiles.find(p => p.id === b.buyer_id) || {};
    const farmer = window.mockProfiles.find(p => p.id === b.farmer_id) || {};
    const slot = window.mockProductSlots.find(s => s.id === b.slot_id) || {};
    return {
      ...b,
      shopName: farmer.name,
      fullName: buyer.name,
      phone: buyer.phone,
      productName: slot.variety_id ? (window.mockVarieties.find(v => v.variety_id === slot.variety_id)?.product_name || "") : "",
      quantityKg: slot.booked_count,
      productType: slot.variety_id ? (window.mockVarieties.find(v => v.variety_id === slot.variety_id)?.variety || "") : "",
      time: b.scheduled_time ? b.scheduled_time.split('T')[1]?.slice(0,5) : '',
      date: b.scheduled_time ? b.scheduled_time.split('T')[0] : '',
      createdAt: b.created_at ? b.created_at.replace('T', ' ') : '',
    };
  });
};

// API: getMockupProducts (join product_slots + profiles)
window.getMockupProducts = function() {
  // Get user location from localStorage
  let userLat = parseFloat(localStorage.getItem('userLat'));
  let userLng = parseFloat(localStorage.getItem('userLng'));
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some(v => typeof v !== 'number' || isNaN(v))) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  return window.mockProductSlots
    .map(slot => {
      // join profile (buyer)
      const buyer = window.mockProfiles.find(u => u.id === slot.buyer_id) || {};
      // join variety
      const variety = window.mockVarieties.find(v => v.variety_id === slot.variety_id) || {};
      // ราคาตามเกรด
      const priceA = slot.grades.find(g => g.grade === "A")?.price || "-";
      const priceB = slot.grades.find(g => g.grade === "B")?.price || "-";
      const priceC = slot.grades.find(g => g.grade === "C")?.price || "-";
      // ระยะทาง (km)
      let distance = '';
      if (userLat && userLng && buyer.deviceAddress && typeof buyer.deviceAddress.lat === 'number' && typeof buyer.deviceAddress.lng === 'number') {
        const dist = getDistanceKm(userLat, userLng, buyer.deviceAddress.lat, buyer.deviceAddress.lng);
        if (dist !== null) distance = dist.toFixed(1) + ' km';
      }
      return {
        slotId: slot.id,
        sellerId: buyer.id,
        sellerName: buyer.name || '',
        sellerSub: variety.product_name ? (variety.product_name + ' ' + (variety.variety || '')) : '',
        avatar: buyer.avatar_url || slot.buyer_img || '',
        priceA,
        priceB,
        priceC,
        distance,
        updateTime: slot.updated_at || (slot.start_date + ' ~ ' + slot.end_date),
        favorite: false,
        status: slot.status,
        grades: slot.grades,
        rounds: slot.rounds,
        start_date: slot.start_date,
        end_date: slot.end_date,
        sellerPhone: buyer.phone || '',
        sellerRole: buyer.role || '',
        varietyName: variety.variety || '',
        productName: variety.product_name || '',
        buyer_id: slot.buyer_id,
      };
    })
    .filter(item => {
      // เฉพาะในรัศมี 100km หรือถ้าไม่ได้ระบุตำแหน่ง user ให้แสดงทั้งหมด
      if (!userLat || !userLng) return true;
      if (!item.distance) return false;
      const km = parseFloat(item.distance);
      return !isNaN(km) && km <= 100;
    });
}
