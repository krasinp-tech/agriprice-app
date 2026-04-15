/**
 * validators/register.js
 * Joi schema สำหรับ POST /api/auth/register/finish
 * Body: { temp_token, role, profile: { firstName, lastName }, password }
 */
const Joi = require('joi');

const registerSchema = Joi.object({
  temp_token: Joi.string().required().messages({
    'any.required': 'กรุณายืนยัน OTP ก่อนสมัครสมาชิก',
    'string.empty': 'temp_token ไม่ถูกต้อง',
  }),
  role: Joi.string().valid('buyer', 'farmer').required().messages({
    'any.only': 'role ต้องเป็น buyer หรือ farmer เท่านั้น',
    'any.required': 'กรุณาเลือก role',
  }),
  profile: Joi.object({
    firstName: Joi.string().min(1).max(50).required().messages({
      'any.required': 'กรุณากรอกชื่อ',
      'string.empty': 'ชื่อห้ามว่าง',
    }),
    lastName: Joi.string().min(1).max(50).required().messages({
      'any.required': 'กรุณากรอกนามสกุล',
      'string.empty': 'นามสกุลห้ามว่าง',
    }),
    // ✓ SIMPLIFIED: Don't validate optional fields - just allow them
    // If they exist and have a value, that's fine. If not, that's also fine.
    email:     Joi.any().optional(),
    phone:     Joi.any().optional(),
    role:      Joi.any().optional(),
    createdAt: Joi.any().optional(),
  }).required().messages({
    'any.required': 'กรุณากรอกข้อมูลโปรไฟล์',
  }),
  password: Joi.string().min(8).max(100).required().messages({
    'string.min': 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร',
    'any.required': 'กรุณากรอกรหัสผ่าน',
    'string.empty': 'รหัสผ่านห้ามว่าง',
  }),
}).options({ allowUnknown: true, abortEarly: true });

module.exports = registerSchema;