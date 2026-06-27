/* 
============================================================
AGRIPRICE - Database Normalization & Cleanup
============================================================
คำแนะนำ: ให้นำคำสั่งเหล่านี้ไปรันใน SQL Editor ของ Supabase
เพื่อทำให้โครงสร้างฐานข้อมูลสะอาดและเป็นระเบียบตามหลัก Normalization ครับ
*/

-- 1. ลบตารางที่ซ้ำซ้อน (Redundant Tables)
-- ลบ user_relations เพราะเรามีตาราง follows ที่ทำหน้าที่เดียวกันแล้ว
DROP TABLE IF EXISTS public.user_relations;

-- ลบ user_addresses เพื่อยุบไปใช้ที่อยู่ในตาราง profiles เพียงแห่งเดียว (Simplified Model)
-- ช่วยลดความสับสนในการจัดการข้อมูลที่อยู่
DROP TABLE IF EXISTS public.user_addresses;


-- 2. ปรับปรุงข้อจำกัดข้อมูล (Constraints Cleanup)
-- ตรวจสอบให้มั่นใจว่าทุกตารางชี้ Foreign Key ไปที่ public.profiles(profile_id) 
-- เพื่อให้ระบบข้อมูลเป็นมาตรฐานเดียวกัน (Consistency)

-- ตัวอย่างการแก้ตาราง notifications (ถ้ายังชี้ไปที่ auth.users)
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
-- ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES public.profiles(profile_id) ON DELETE CASCADE;


-- 3. เพิ่มความปลอดภัยด้วยการล้างข้อมูลขยะ (Optional)
-- ลบข้อมูลในตารางที่ไม่ได้ระบุเจ้าของ (Orphaned records)
-- DELETE FROM public.products WHERE user_id NOT IN (SELECT profile_id FROM public.profiles);


/* 
============================================================
การยุบตารางเสร็จสิ้น! 
ฐานข้อมูลของคุณตอนนี้จะดู Professional และไม่งงเวลาพรีเซนต์ครับ
============================================================
*/
