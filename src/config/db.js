'use strict';

/**
 * 数据库连接池（对应原卷「数据访问层」的底层连接部分）。
 *
 * 用连接池而非单个连接：Express 每个请求可能并发访问数据库，
 * 单连接会被串行化并成为瓶颈；池化管理连接的复用与超时。
 */

// 必须先加载 .env，下面的 createPool 才能读到连接参数
require('./env');

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'book_manage',

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',

  // 让 DATE / DATETIME 以字符串原样返回，避免驱动转成 JS Date 后
  // 因时区转换导致「入库时间」出现 2014-07-02 这种差一天的情况。
  dateStrings: true,

  // 关闭多语句，降低注入风险（本项目无需一次执行多条 SQL）
  multipleStatements: false,
});

/**
 * 启动时探活，让「数据库连不上」这类问题在启动阶段就暴露，
 * 而不是等用户点开页面才报 500。
 * @returns {Promise<{version: string, database: string}>}
 */
async function checkConnection() {
  const [rows] = await pool.query(
    'SELECT VERSION() AS version, DATABASE() AS `database`'
  );
  return rows[0];
}

module.exports = pool;
module.exports.checkConnection = checkConnection;
