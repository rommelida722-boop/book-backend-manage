'use strict';

/**
 * Jest 配置。
 *
 * 说明几个刻意的选择：
 *   testEnvironment: node   —— 主测试打接口与数据库，用不到浏览器环境
 *   maxWorkers: 1           —— 用例都打同一个真库，并发跑会互相看到对方新增/删除的记录
 *   globalSetup/Teardown    —— 整个测试前建测试库并导种子数据，跑完删库，零副作用
 *   setupFilesAfterEnv      —— 每个测试文件前重导一次种子数据，用例之间天然隔离
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],

  maxWorkers: 1,
  verbose: true,

  // 覆盖率只统计真正的业务代码，种子/配置/测试自身不算进分母
  collectCoverageFrom: [
    'src/**/*.js',
    'app.js',
    '!src/config/env.js',
  ],
};
