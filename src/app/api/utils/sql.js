import pg from 'pg';

const { Pool } = pg;

// Usamos el pool global para mantener la eficiencia de las conexiones
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

/**
 * Función compatible con la sintaxis de Neon para ejecutar consultas
 * Permite usar: await sql`SELECT * FROM users`
 */
const sql = async (strings, ...values) => {
  // Convierte el template literal a una consulta de pg estándar
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), "");
  const result = await pool.query(query, values);
  return result.rows;
};

// Mock de transacción simple por si el código la requiere
sql.transaction = async (queries) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const q of queries) {
      results.push(await client.query(q));
    }
    await client.query('COMMIT');
    return results;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export default sql;