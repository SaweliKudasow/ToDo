const mysql = require('mysql2/promise');

for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env — copy .env.example to .env`);
    process.exit(1);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME
});

const PORT = Number(process.env.PORT) || 3000;

module.exports = { pool, JWT_SECRET, PORT };
