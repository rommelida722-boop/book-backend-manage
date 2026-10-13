'use strict';

/**
 * Jest globalTeardown：全部测试跑完后删掉测试库。
 *
 * 让 npm test 不留任何副作用——测试库每次都会重新建，
 * 保留它没有意义，反而会让下次的建库结果变得不可预期。
 */

const mysql = require('mysql2/promise');
const { TEST_DB_NAME, scriptConnectionOptions } = require('./testDb');

module.exports = async () => {
  const conn = await mysql.createConnection(scriptConnectionOptions);

  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
    console.log(`\n[test] 测试库 ${TEST_DB_NAME} 已删除\n`);
  } finally {
    await conn.end();
  }
};
