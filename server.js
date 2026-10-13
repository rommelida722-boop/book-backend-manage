'use strict';

/**
 * 启动入口：先探活数据库，再监听端口。
 *
 * 先探活的好处：数据库没配好时在启动阶段就报清楚的错，
 * 而不是等服务起来了、用户点开页面才发现每个请求都 500。
 */

const app = require('./app');
const pool = require('./src/config/db');
const { PORT } = require('./src/config/constants');

async function bootstrap() {
  try {
    const info = await pool.checkConnection();
    console.log(`[db] 已连接 MySQL ${info.version}，当前数据库：${info.database}`);
  } catch (error) {
    console.error('[db] 数据库连接失败：', error.message);
    console.error('[db] 请检查：');
    console.error('     1) MySQL 服务是否已启动');
    console.error('     2) 项目根目录下的 .env 是否已按 .env.example 填好');
    console.error('     3) 是否已导入 sql/schema.sql 与 sql/data.sql');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[web] 图书借阅系统后台管理已启动： http://localhost:${PORT}`);
  });
}

bootstrap();
