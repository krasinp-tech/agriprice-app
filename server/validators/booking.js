/**
 * validators/booking.js
 * Joi schema สำหรับ POST /api/bookings
 */
const Joi = require('joi');

const bookingSchema = Joi.object({
  buyer_id:       Joi.string().uuid().optional().allow(null, ''),
  farmer_id:      Joi.string().uuid().optional().allow(null, ''),
  product_id:     Joi.string().optional().allow(null, ''),
  slot_id:        Joi.string().optional().allow(null, ''),
  scheduled_time: Joi.string().required().messages({
    'any.required': 'กรุณาระบุวันเวลานัด',
    'string.empty': 'วันเวลานัดห้ามว่าง',
  }),
  note:          Joi.string().optional().allow('', null),
  address:       Joi.string().optional().allow('', null),
  contact_name:  Joi.string().optional().allow('', null),
  contact_phone: Joi.string().optional().allow('', null),
  product_amount:Joi.number().optional().allow(null),
  vehicle_plates:Joi.alternatives().try(Joi.array(), Joi.object(), Joi.string()).optional().allow(null),
}).options({ allowUnknown: false });

module.exports = bookingSchema;