// db.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '192.168.1.2',
  user: 'ccfood',
  password: 'CCfood2024',
  database: 'gnik',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();  // Enable async/await
