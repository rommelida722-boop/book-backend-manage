'use strict';

/**
 * 统一加载 .env。
 *
 * 单独抽成一个模块并被各配置模块 require，是为了保证「先读环境变量、再导出配置」
 * 这个顺序与入口文件（server.js / app.js / 测试）无关，避免出现
 * 「直接 require 某个模块时环境变量还没加载」的隐蔽 bug。
 *
 * dotenv 默认不覆盖已存在的 process.env，所以测试里显式设置的环境变量优先级更高
 * （例如把 DB_NAME 指向 book_manage_test，避免测试污染开发库）。
 */

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

module.exports = process.env;
