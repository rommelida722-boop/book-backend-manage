'use strict';

/**
 * 路由 / 控制器层（对应原卷「创建并配置控制器类…对结果和消息进行保存并导航到指定页面」）。
 *
 * 这一层只做三件事：解析 HTTP 参数 → 调用 service → 选模板或决定跳转。
 * 业务规则一律不写在这里，全部下沉到 services/bookService.js。
 */

const express = require('express');

const bookService = require('../services/bookService');
const { asyncHandler, buildBackSuffix, resolveFlash } = require('../utils/http');
const { FLASH_MESSAGES } = require('../config/constants');

const router = express.Router();

/**
 * ★ 路由注册顺序很重要：
 *   `/books/new` 必须写在 `/books/:id` 之前，
 *   否则 Express 会先命中 `:id`，把字符串 "new" 当成图书 ID 去查库。
 */

// ---------------------------------------------------------------------------
// 功能 1 + 2：图书列表（默认全部）与按图书名称模糊查询，均分页、按入库时间降序
// 对应原卷图-1、图-2
// ---------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { books, pagination, query } = await bookService.listBooks({
      name: req.query.name,
      page: req.query.page,
    });

    res.render('list', {
      books,
      pagination,
      query,
      // 新增 / 修改 / 删除完成后跳回本页时带的提示（图-5 / 图-7 / 图-9）
      flash: resolveFlash(FLASH_MESSAGES, req.query.msg),
      // 查看 / 修改 / 新增三个链接都要带上当前的查询条件与页码
      backSuffix: buildBackSuffix(req),
    });
  })
);

// ---------------------------------------------------------------------------
// 功能 4：新增图书 —— 打开新增页
// 对应原卷图-4
// ---------------------------------------------------------------------------
router.get(
  '/books/new',
  asyncHandler(async (req, res) => {
    const bookTypes = await bookService.listBookTypes();

    res.render('form', {
      mode: 'new',
      book: bookService.buildNewFormDefaults(),
      bookTypes,
      errors: [],
      flash: '',
      action: '/books',
      backSuffix: buildBackSuffix(req),
    });
  })
);

// ---------------------------------------------------------------------------
// 功能 4：新增图书 —— 提交保存
// 成功后跳回列表页并提示「新增成功！」（图-5）
// ---------------------------------------------------------------------------
router.post(
  '/books',
  asyncHandler(async (req, res) => {
    const result = await bookService.createBook(req.body);

    if (!result.ok) {
      // 校验失败：把用户已填的内容原样退回表单，逐字段标出错误，并弹「新增失败！」
      // （前端的 jQuery 校验会拦下绝大多数情况，走到这里通常是 JS 被禁用或参数被篡改）
      const bookTypes = await bookService.listBookTypes();

      return res.status(400).render('form', {
        mode: 'new',
        book: { ...bookService.buildNewFormDefaults(), ...req.body },
        bookTypes,
        errors: result.errors,
        flash: FLASH_MESSAGES.create_fail,
        action: '/books',
        backSuffix: buildBackSuffix(req),
      });
    }

    // 原卷要求：点击保存后再次跳转到图书信息列表页面
    return res.redirect('/?msg=create_ok');
  })
);

// ---------------------------------------------------------------------------
// 功能 3：查看图书详情（页面所有字段只读）
// 对应原卷图-3
// ---------------------------------------------------------------------------
router.get(
  '/books/:id',
  asyncHandler(async (req, res) => {
    const book = await bookService.getBookDetail(req.params.id);

    if (!book) {
      return res.status(404).render('error', {
        title: '图书不存在',
        message: '未找到该图书，可能已被删除。',
        backSuffix: buildBackSuffix(req),
      });
    }

    return res.render('detail', {
      book,
      backSuffix: buildBackSuffix(req),
    });
  })
);

// ---------------------------------------------------------------------------
// 功能 5：修改图书 —— 打开修改页（入库人 / 入库时间只读）
// 对应原卷图-6
// ---------------------------------------------------------------------------
router.get(
  '/books/:id/edit',
  asyncHandler(async (req, res) => {
    const book = await bookService.getBookDetail(req.params.id);

    if (!book) {
      return res.status(404).render('error', {
        title: '图书不存在',
        message: '未找到该图书，可能已被删除。',
        backSuffix: buildBackSuffix(req),
      });
    }

    const bookTypes = await bookService.listBookTypes();

    return res.render('form', {
      mode: 'edit',
      book,
      bookTypes,
      errors: [],
      flash: '',
      action: `/books/${book.bookId}`,
      backSuffix: buildBackSuffix(req),
    });
  })
);

// ---------------------------------------------------------------------------
// 功能 5：修改图书 —— 提交保存
// 成功后跳回列表页并提示「修改成功！」（图-7）
// ---------------------------------------------------------------------------
router.post(
  '/books/:id',
  asyncHandler(async (req, res) => {
    const result = await bookService.updateBook(req.params.id, req.body);

    if (!result.ok) {
      // 记录不存在：回列表页提示失败
      if (result.reason) {
        return res.redirect('/?msg=update_fail');
      }

      const bookTypes = await bookService.listBookTypes();

      return res.status(400).render('form', {
        mode: 'edit',
        book: { ...req.body, bookId: req.params.id },
        bookTypes,
        errors: result.errors,
        flash: FLASH_MESSAGES.update_fail,
        action: `/books/${req.params.id}`,
        backSuffix: buildBackSuffix(req),
      });
    }

    return res.redirect('/?msg=update_ok');
  })
);

// ---------------------------------------------------------------------------
// 功能 6：删除图书
// 用 POST 而不是 GET：GET 语义是「读取」，会被浏览器预取、被爬虫扫到，
// 用 GET 删数据意味着打开一个链接就删记录。确认框由页面上的 confirm() 负责（图-8）。
// 删除后跳回列表页并提示「删除成功！」/「删除失败！」（图-9）
// ---------------------------------------------------------------------------
router.post(
  '/books/:id/delete',
  asyncHandler(async (req, res) => {
    const result = await bookService.deleteBook(req.params.id);

    return res.redirect(result.ok ? '/?msg=delete_ok' : '/?msg=delete_fail');
  })
);

module.exports = router;
