const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  const sqlFile = process.env.SQL_FILE || 'database.sql';
  if (!fs.existsSync(sqlFile)) {
    console.error('Arquivo SQL não encontrado:', sqlFile);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : (process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : 3306),
    user: process.env.DATABASE_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DATABASE_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DATABASE_NAME || process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
    connectTimeout: 10000
  });

  try {
    console.log('Conectando ao DB', { host: pool.config.connectionConfig.host, port: pool.config.connectionConfig.port, user: pool.config.connectionConfig.user, database: pool.config.connectionConfig.database });
    const conn = await pool.getConnection();
    try {
      console.log('Executando import (pode demorar)...');
      await conn.query(sql);
      console.log('Importação concluída com sucesso.');
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Falha na importação:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
