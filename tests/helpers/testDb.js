'use strict';

/**
 * 测试用数据库配置（globalSetup / setup / 各用例共用）。
 *
 * 核心约定：**测试打的是真库，不是 mock**。
 * 作业第 6 条要求「使用 Actions 进行回归测试」，而本项目真正容易出问题的地方
 * （字符集、日期格式、外键、UPDATE 漏列导致被篡改）恰恰只有连真库才验得出来，
 * mock 掉的 DAO 层会让这些回归全部失去意义。
 *
 * 因此测试库刻意与开发库分开：
 *   开发库 book_manage       —— 你平时 npm start 用的
 *   测试库 book_manage_test  —— npm test 每次重建，跑完即删
 * 这样 npm test 永远不会动到你手动导入的数据。
 */

const fs = require('fs');
const path = require('path');

// 加载 .env（dotenv 默认不覆盖已存在的环境变量），
// 这样本地直接复用 .env 里的连接信息，CI 上则由 workflow 注入。
require(path.resolve(__dirname, '..', '..', 'src', 'config', 'env'));

const ROOT = path.resolve(__dirname, '..', '..');
const SQL_DIR = path.join(ROOT, 'sql');

/** 测试库名 */
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'book_manage_test';

/** 连接参数（不含 database）——建库/删库时要用 */
const connectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

/**
 * 读取 sql/ 下的脚本，并把库名替换成测试库名。
 *
 * ★ 必须替换的原因：schema.sql 第 13 行是 `DROP DATABASE IF EXISTS book_manage`。
 *   原样执行会把开发库整个删掉。库名在 sql 里只出现 4 次（DROP / CREATE / USE / USE），
 *   且不存在其它同名标识符，所以按词边界整体替换是安全的。
 *
 * @param {string} fileName sql 目录下的文件名
 * @param {string} dbName   目标库名
 * @returns {string}
 */
function readSql(fileName, dbName) {
  const raw = fs.readFileSync(path.join(SQL_DIR, fileName), 'utf8');
  return raw.replace(/\bbook_manage\b/g, dbName);
}

/** 建连参数：多个 sql 脚本一次执行，必须开 multipleStatements */
const scriptConnectionOptions = {
  ...connectionOptions,
  multipleStatements: true,
  charset: 'utf8mb4_general_ci',
};

module.exports = {
  ROOT,
  SQL_DIR,
  TEST_DB_NAME,
  connectionOptions,
  scriptConnectionOptions,
  readSql,
};
