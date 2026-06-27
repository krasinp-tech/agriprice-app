/* 
============================================================
AGRIPRICE - Final Database Optimization & Security
============================================================
คำแนะนำ: ให้นำคำสั่งทั้งหมดนี้ไปวางและรันในหน้า "SQL Editor" ของ Supabase ครับ
*/

-- ── 1. เพิ่มประสิทธิภาพการค้นหา (Performance Indexes) ──
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products (name, category, variety);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON public.chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);


-- ── 2. ระบบอัปเดตเวลาอัตโนมัติ (Updated At Triggers) ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- ── 3. ป้องกันข้อมูลซ้ำ (Integrity Fixes) ──
ALTER TABLE public.gov_prices 
ADD CONSTRAINT gov_prices_unique_entry UNIQUE (commodity, variety, price_date);


-- ── 4. ระบบความปลอดภัย (Row Level Security - RLS) ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- นโยบายโปรไฟล์
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
    FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles
    FOR UPDATE USING (auth.uid() = profile_id);

-- นโยบายแชท
CREATE POLICY "Users can see messages in their rooms" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms 
            WHERE chat_rooms.room_id = chat_messages.room_id 
            AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages to their rooms" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rooms 
            WHERE chat_rooms.room_id = chat_messages.room_id 
            AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
        )
    );
