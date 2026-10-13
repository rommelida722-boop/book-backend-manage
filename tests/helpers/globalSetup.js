'use strict';

/**
 * Jest globalSetup：整个测试跑之前执行一次。
 *
 * 做两件事：重建测试库（schema.sql）+ 导入种子数据（data.sql）。
 * 用的就是仓库里那两份 .sql，和手工导入的是同一份文件，
 * 所以测试验的结构与数据，跟你照着 README 装出来的环境完全一致。
 */

const mysql = require('mysql2/promise');
const {
  TEST_DB_NAME,
  scriptConnectionOptions,
  readSql,
} = require('./testDb');

module.exports = async () => {
  const conn = await mysql.createConnection(scriptConnectionOptions);

  try {
    // schema.sql 自带 DROP DATABASE IF EXISTS + CREATE DATABASE + USE，建库一步到位
    await conn.query(readSql('schema.sql', TEST_DB_NAME));
    await conn.query(readSql('data.sql', TEST_DB_NAME));

    const [[{ books }]] = await conn.query(
      `SELECT COUNT(*) AS books FROM \`${TEST_DB_NAME}\`.book_info`
    );

    console.log(
      `\n[test] 测试库 ${TEST_DB_NAME} 重建完成，book_info 种子数据 ${books} 条\n`
    );
  } finally {
    await conn.end();
  }
};
