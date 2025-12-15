const mysql = require('mysql2');

// Carregar dotenv também aqui para diagnósticos (sem problema se já estiver carregado)
try { require('dotenv').config(); } catch (e) { }

const DB_HOST = process.env.DATABASE_HOST || 'localhost';
const DB_USER = process.env.DATABASE_USER || 'root';
const DB_PASSWORD = process.env.DATABASE_PASSWORD || '';
const DB_NAME = process.env.DATABASE_NAME || 'pwa';

// Log de diagnóstico (NÃO registrar a senha)
console.log(`DB config -> host=${DB_HOST}, user=${DB_USER}, database=${DB_NAME}, hasPassword=${DB_PASSWORD ? 'yes' : 'no'}`);

if (process.env.NODE_ENV === 'production' && !DB_PASSWORD) {
  console.error('ERROR: DATABASE_PASSWORD is not set. Set DATABASE_PASSWORD in the environment before starting in production.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Garantir que a conexão/sessão use UTC para que NOW() e session time_zone do servidor fiquem em UTC.
// Isso mantém as funções temporais do banco consistentes com o tratamento de UTC do backend.
try {
  // O pool do mysql2 emite 'connection' para cada nova conexão criada
  pool.on && pool.on('connection', (connection) => {
    try {
      connection.query("SET time_zone = '+00:00'");
    } catch (e) {
      // ignorar erros aqui
    }
  });
} catch (e) {
  // ignorar se não for suportado
}

// Testar rapidamente a conexão e logar um erro amigável caso falhe
(async () => {
  try {
    const promisePool = pool.promise();
    const [rows] = await promisePool.execute('SELECT 1');
    // conexão bem-sucedida; nada mais a fazer
  } catch (err) {
    console.error('Teste de conexão com o DB falhou:', err && err.message ? err.message : err);
  }
})();

module.exports = pool.promise();
