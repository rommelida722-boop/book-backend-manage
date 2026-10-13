'use strict';

/**
 * Express 应用装配（不含 listen，便于 supertest 直接引入做接口测试）。
 */

const path = require('path');
const express = require('express');

const bookRoutes = require('./src/routes/bookRoutes');

const app = express();

// —— 视图引擎：EJS 服务端渲染 ——
// 选服务端渲染而非前后端分离，是因为原卷的交互模型就是「跳转页面」：
// 保存后跳回列表、返回时保留查询条件，SSR 最贴合，也省掉一层接口约定。
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// —— 静态资源 ——
app.use(express.static(path.join(__dirname, 'public')));

// —— 表单解析 ——
// extended:false 用 Node 内置的 querystring，只支持扁平字段，正好够用且更安全
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// —— 业务路由 ——
app.use('/', bookRoutes);

// —— 404 ——
app.use((req, res) => {
  res.status(404).render('error', {
    title: '页面不存在',
    message: `没有找到地址 ${req.originalUrl}，请从列表页重新进入。`,
    backSuffix: '',
  });
});

// —— 统一错误处理 ——
// 原卷注意事项第 3 条要求「操作数据库时进行必要的异常处理」：
// 这里兜住所有未捕获异常，日志打全栈，页面只给一句人话，不把 SQL 和堆栈暴露给用户。
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err);

  res.status(500).render('error', {
    title: '系统错误',
    message: '服务器处理请求时发生错误，请稍后重试。',
    backSuffix: '',
  });
});

module.exports = app;
