'use strict';

/**
 * setupFilesAfterEnv：每个测试文件执行前都会跑一遍。
 *
 * ★ 这里第一行就把 DB_NAME 指向测试库，且**必须早于任何 src/ 模块被 require**。
 *   原因是 src/config/db.js 在首次 require 时就 createPool 了，
 *   一旦它先加载完，后面再改 process.env.DB_NAME 也不会影响已建好的连接池。
 *   （env.js 用的是 dotenv 默认的 override:false，所以这里显式设置的值不会被 .env 覆盖。）
 */

process.env.DB_NAME = require('./testDb').TEST_DB_NAME;

const { reseed } = require('./seed');
const pool = require('../../src/config/db');

// 打真库的用例串行跑（jest.config.js 里已设 maxWorkers=1），给足超时
jest.setTimeout(30000);

// 每个测试文件都从同一份种子数据出发
beforeAll(async () => {
  await reseed();
});

// 连接池不关，Jest 会因为句柄未释放而挂住不退出
afterAll(async () => {
  await pool.end();
});
