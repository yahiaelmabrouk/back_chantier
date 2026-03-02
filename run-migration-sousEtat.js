require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chantier_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    await c.execute('ALTER TABLE chantiers ADD COLUMN sousEtat VARCHAR(30) DEFAULT NULL');
    console.log('Column sousEtat added successfully');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column sousEtat already exists, skipping');
    } else {
      throw e;
    }
  }

  await c.execute("UPDATE chantiers SET sousEtat = 'facturé' WHERE numBonFacture IS NOT NULL AND TRIM(numBonFacture) != ''");
  const [r] = await c.execute("SELECT COUNT(*) as cnt FROM chantiers WHERE sousEtat = 'facturé'");
  console.log('Backfilled:', r[0].cnt, 'chantiers as facturé');

  await c.end();
  console.log('Migration complete');
})();
