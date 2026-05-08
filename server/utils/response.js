/**
 * response.js
 * Helper สร้าง response มาตรฐาน { success, message, data }
 */

/**
 * Success response
 * @param {string} message
 * @param {*} data
 */
function success(message = 'สำเร็จ', data = null) {
  const res = { success: true, message };
  if (data !== null && data !== undefined) res.data = data;
  return res;
}

/**
 * Error response
 * @param {string} message
 * @param {*} details  — ข้อมูลเพิ่มเติม (ไม่แสดงใน production)
 */
function error(message = 'เกิดข้อผิดพลาด', details = null) {
  const res = { success: false, message };
  if (details !== null && process.env.NODE_ENV !== 'production') {
    res.details = details;
  }
  return res;
}

module.exports = { success, error };