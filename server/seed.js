/**
 * scripts/seed_test_users.js
 * Script to create 5 test users in Bangkok with random products.
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin actions
);

const BANGKOK_LOCATIONS = [
  { name: 'Siam', lat: 13.7456, lng: 100.5341 },
  { name: 'Sukhumvit', lat: 13.7367, lng: 100.5612 },
  { name: 'Ari', lat: 13.7796, lng: 100.5452 },
  { name: 'Bang Na', lat: 13.6678, lng: 100.6225 },
  { name: 'Pinklao', lat: 13.7761, lng: 100.4859 }
];

const FRUITS = [
  { name: 'ทุเรียนหมอนทอง', category: 'ทุเรียน', variety: 'หมอนทอง', unit: 'กก.', price: 150 },
  { name: 'มังคุดคัด', category: 'มังคุด', variety: 'คัดเกรด', unit: 'กก.', price: 80 },
  { name: 'มะม่วงน้ำดอกไม้', category: 'มะม่วง', variety: 'น้ำดอกไม้สีทอง', unit: 'กก.', price: 60 },
  { name: 'เงาะโรงเรียน', category: 'เงาะ', variety: 'โรงเรียน', unit: 'กก.', price: 45 },
  { name: 'ลำไยอีดอ', category: 'ลำไย', variety: 'อีดอ', unit: 'กก.', price: 40 }
];

async function seed() {
  console.log('🚀 Starting Seeding Process...');

  for (let i = 0; i < 5; i++) {
    const rawPhone = `082000000${i + 1}`;
    const phone = `+6682000000${i + 1}`;
    const email = `testuser_v2_${i + 1}@agriprice.com`;
    const password = 'password123';
    const loc = BANGKOK_LOCATIONS[i];

    console.log(`\n--- Creating User ${i + 1}: ${phone} ---`);

    try {
      // 1. Create User in Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        phone,
        password,
        email_confirm: true,
        phone_confirm: true
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`[Warn] User ${phone} already exists, skipping auth creation.`);
          continue;
        }
        throw authError;
      }

      const userId = authData.user.id;
      console.log(`[OK] Auth user created: ${userId}`);

      // 2. Upsert Profile (Ensure it exists for foreign key)
      const { error: profError } = await supabase
        .from('profiles')
        .upsert({
          profile_id: userId,
          first_name: `ผู้ทดสอบ`,
          last_name: `${i + 1} (${loc.name})`,
          role: 'farmer',
          lat: loc.lat,
          lng: loc.lng,
          address_line1: `เขต${loc.name} กรุงเทพมหานคร`,
          phone: phone 
        }, { onConflict: 'profile_id' });

      if (profError) throw profError;
      console.log(`[OK] Profile upserted with location: ${loc.name}`);

      // Small delay to ensure DB consistency
      await new Promise(r => setTimeout(r, 1000));

      // 3. Create 3 Random Products
      for (let j = 0; j < 3; j++) {
        const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
        const { error: prodError } = await supabase
          .from('products')
          .insert({
            user_id: userId,
            name: fruit.name,
            category: fruit.category,
            variety: fruit.variety,
            unit: fruit.unit,
            price: fruit.price + Math.floor(Math.random() * 20),
            quantity: 100 + Math.floor(Math.random() * 500),
            description: `สินค้าคุณภาพดีจากสวนเขต${loc.name} สนใจติดต่อสอบถามได้ครับ`,
            is_active: true
          });
        
        if (prodError) throw prodError;
      }
      console.log(`[OK] 3 Products created.`);

    } catch (err) {
      console.error(`[Error] Failed to seed user ${i + 1}:`, err.message);
    }
  }

  console.log('\n✅ Seeding Complete!');
}

seed();
