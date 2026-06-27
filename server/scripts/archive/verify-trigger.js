const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Fetch one buy_offer with grades
    const resOffer = await pool.query(`
      SELECT product_id, name, grades 
      FROM public.buy_offers 
      WHERE grades IS NOT NULL AND jsonb_array_length(grades) > 0 
      LIMIT 1
    `);
    
    if (resOffer.rows.length === 0) {
      console.log('No buy_offers with grades found to test.');
      return;
    }
    
    const offer = resOffer.rows[0];
    const offerId = offer.product_id;
    const originalGrades = offer.grades;
    
    console.log(`Testing with Buy Offer ID ${offerId} (${offer.name})`);
    console.log('Original JSONB grades:', JSON.stringify(originalGrades));
    
    // Check initial offer_grades rows
    const resInitialGrades = await pool.query(`
      SELECT grade_name, price 
      FROM public.offer_grades 
      WHERE offer_id = $1
    `, [offerId]);
    console.log('Initial offer_grades rows in DB:', resInitialGrades.rows);
    
    // 2. Update buy_offers.grades to a new JSONB array
    const testGrades = [
      { grade: 'Grade Premium A+', price: 950 },
      { grade: 'Grade B-', price: 520 }
    ];
    
    console.log('Updating grades JSONB in buy_offers table...');
    await pool.query(`
      UPDATE public.buy_offers 
      SET grades = $1::jsonb 
      WHERE product_id = $2
    `, [JSON.stringify(testGrades), offerId]);
    
    // Check if offer_grades table was automatically synchronized
    const resSyncedGrades = await pool.query(`
      SELECT grade_name, price 
      FROM public.offer_grades 
      WHERE offer_id = $1
      ORDER BY grade_name
    `, [offerId]);
    
    console.log('Synced offer_grades rows in DB after update:', resSyncedGrades.rows);
    
    // Validate trigger correctness
    const success = resSyncedGrades.rows.length === 2 &&
      resSyncedGrades.rows.some(r => r.grade_name === 'Grade Premium A+' && Number(r.price) === 950) &&
      resSyncedGrades.rows.some(r => r.grade_name === 'Grade B-' && Number(r.price) === 520);
      
    if (success) {
      console.log('✅ Success: Trigger synchronized grades JSONB array to offer_grades table correctly!');
    } else {
      console.error('❌ Failure: Trigger did not synchronize grades correctly.');
    }
    
    // 3. Restore original grades array
    console.log('Restoring original grades JSONB...');
    await pool.query(`
      UPDATE public.buy_offers 
      SET grades = $1::jsonb 
      WHERE product_id = $2
    `, [JSON.stringify(originalGrades), offerId]);
    
    // Verify restored state
    const resRestoredGrades = await pool.query(`
      SELECT grade_name, price 
      FROM public.offer_grades 
      WHERE offer_id = $1
    `, [offerId]);
    console.log('Restored offer_grades rows in DB:', resRestoredGrades.rows.length);
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await pool.end();
  }
}

main();
