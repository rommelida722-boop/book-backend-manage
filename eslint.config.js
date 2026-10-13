'use strict';

/**
 * ESLint 扁平配置（ESLint 9+ 的默认形式）。
 *
 * 项目里有两类运行环境完全不同的 JS，必须分开约束：
 *   - 服务端 / 测试：Node + CommonJS（src、tests、app.js、server.js）
 *   - 浏览器脚本：public/js 下的两个文件，跑在浏览器里，还依赖 jQuery
 * 混在一起会满屏报 no-undef（比如把 `window` 报成未定义）。
 */

const js = require('@eslint/js');

/** 服务端与测试共用的全局变量 */
const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URLSearchParams: 'readonly',
};

/** 浏览器脚本的全局变量（public/js/*.js） */
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  // 页面通过 <script> 引入的 jQuery 1.8.3
  jQuery: 'readonly',
  $: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
};

module.exports = [
  {
    // 第三方与产物一律不检查
    ignores: [
      'node_modules/**',
      'coverage/**',
      'public/vendor/**', // 本地化的 jQuery 1.8.3，压缩代码
    ],
  },

  js.configs.recommended,

  // —— 服务端 / 测试 / 配置 ——
  {
    files: [
      'src/**/*.js',
      'tests/**/*.js',
      'app.js',
      'server.js',
      'jest.config.js',
      'eslint.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: {
      'no-console': 'off',
      // 允许形如 `next` 这种「签名要求但没用上」的参数
      'no-unused-vars': ['error', { argsIgnorePattern: '^next$' }],
    },
  },

  // —— 浏览器脚本 ——
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 5, // jQuery 1.8.3 时代的写法，刻意不用 ES6 语法
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: {
      'no-console': 'off',
    },
  },

  // —— 测试文件用到 Jest 的全局函数 ——
  {
    files: ['tests/**/*.test.js', 'tests/helpers/setup.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
