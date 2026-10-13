'use strict';

/**
 * 重新导入种子数据。
 *
 * 每个测试文件开始前都会调用一次（见 setup.js），
 * 这样「上一个文件新增/删除的记录」不会影响「下一个文件」的断言，
 * 用例之间天然隔离，不必靠小心翼翼的清理代码维持秩序。
 */

const mysql = require('mysql2/promise');
const { TEST_DB_NAME, scriptConnectionOptions, readSql } = require('./testDb');

/**
 * 执行 sql/data.sql（内含 DELETE + 重置自增 + INSERT，是幂等的）。
 * @returns {Promise<void>}
 */
async function reseed() {
  const conn = await mysql.createConnection(scriptConnectionOptions);

  try {
    await conn.query(readSql('data.sql', TEST_DB_NAME));
  } finally {
    await conn.end();
  }
}

module.exports = { reseed };
