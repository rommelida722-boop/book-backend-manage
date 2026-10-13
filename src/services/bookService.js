'use strict';

/**
 * 图书业务层（对应原卷「创建 Service 接口及其实现类，实现相应业务，并在类中加入 DAO 引用」）。
 *
 * 职责划分：
 *   - models/  只拼 SQL、取数据
 *   - services/（本文件）做校验、默认值、分页计算、视图模型转换
 *   - routes/  只负责解析 HTTP 参数、调用服务、选模板、决定跳转
 */

const bookModel = require('../models/bookModel');
const bookTypeModel = require('../models/bookTypeModel');
const { buildPagination, normalizePage } = require('../utils/pagination');
const {
  DEFAULT_CREATED_BY,
  PAGE_SIZE,
  BORROWED_TEXT,
} = require('../config/constants');

/** 各字段的最大长度，与 sql/schema.sql 中的 VARCHAR 定义保持一致 */
const MAX_LENGTH = {
  bookCode: 50,
  bookName: 100,
  bookAuthor: 50,
  publishPress: 100,
  createdBy: 50,
};

/** 入库时间 / 出版日期只接受「年-月-日」 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 取本地当天日期，格式 yyyy-MM-dd。
 *
 * 刻意不用 toISOString()：那是 UTC 时间，在东八区晚上 8 点后算出来的「今天」
 * 会比本地日期早一天，会出现「入库时间显示昨天」的问题。
 * @returns {string} 例如 2014-07-03
 */
function todayString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 把数据库行转成页面直接可用的视图模型：把 0/1 翻译成「未借阅 / 已借阅」。
 * 原卷图-1 列表里显示的是中文，不是数字。
 * @param {object} row
 * @returns {object}
 */
function toViewModel(row) {
  return {
    ...row,
    borrowedText: BORROWED_TEXT[row.borrowed] || BORROWED_TEXT[0],
  };
}

/**
 * 列表查询（默认全部图书，支持按图书名称模糊查询，分页）。
 *
 * @param {object} options
 * @param {string} options.name 图书名称查询条件
 * @param {*} options.page      页码
 * @returns {Promise<{books: object[], pagination: object, query: {name: string, page: number}}>}
 */
async function listBooks({ name = '', page } = {}) {
  const keyword = String(name == null ? '' : name).trim();

  // 先查总数：总页数得在查列表前算出来，才能对越界页码做钳制
  const total = await bookModel.countAll(keyword);
  const pagination = buildPagination({
    total,
    page: normalizePage(page),
    pageSize: PAGE_SIZE,
  });

  const rows = await bookModel.findPage({
    name: keyword,
    limit: PAGE_SIZE,
    offset: pagination.offset,
  });

  return {
    books: rows.map(toViewModel),
    pagination,
    // 回传给页面，用于输入框回填与链接透传
    query: { name: keyword, page: pagination.page },
  };
}

/**
 * 查询单本图书详情。找不到返回 null，由路由决定跳 404 页。
 * @param {*} bookId
 * @returns {Promise<object|null>}
 */
async function getBookDetail(bookId) {
  const id = Number.parseInt(bookId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const row = await bookModel.findById(id);
  return row ? toViewModel(row) : null;
}

/**
 * 取图书类型下拉框的选项（原卷要求必须来自 book_type 表）。
 * @returns {Promise<Array<{id: number, typeName: string}>>}
 */
async function listBookTypes() {
  return bookTypeModel.findAll();
}

/**
 * 新增页的初始值，对应原卷图-4：
 *   入库人 = 系统管理员、入库时间 = 当天、是否借阅 = 未借阅，
 *   图书类型下拉默认停在「——请选择——」
 * @returns {object}
 */
function buildNewFormDefaults() {
  return {
    bookCode: '',
    bookName: '',
    bookType: '',
    bookAuthor: '',
    publishPress: '',
    borrowed: String(0),
    createdBy: DEFAULT_CREATED_BY,
    creationTime: todayString(),
  };
}

/**
 * 服务端校验。
 *
 * 前端已经用 jQuery 做了同样的校验，但**服务端必须再校验一遍**：
 * 用户可以直接 POST、可以禁用 JS，前端校验只是体验优化，不是安全边界。
 *
 * 校验规则严格对齐原卷图-4 的必填星号 `*`：
 *   必填 = 图书编号、图书名称、图书类型、是否借阅、入库人、入库时间
 *   选填 = 作者、出版社（图-4 里这两项没有星号）
 *   表单中不存在「出版日期」，由系统补当天日期
 *
 * @param {object} raw 表单原始输入
 * @returns {Promise<{data: object, errors: Array<{field: string, message: string}>}>}
 */
async function validateBookForm(raw = {}) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });

  const text = (value) => (value == null ? '' : String(value).trim());

  // —— 图书编号：必填 ——
  const bookCode = text(raw.bookCode);
  if (!bookCode) {
    push('bookCode', '图书编号不能为空');
  } else if (bookCode.length > MAX_LENGTH.bookCode) {
    push('bookCode', `图书编号长度不能超过 ${MAX_LENGTH.bookCode} 个字符`);
  }

  // —— 图书名称：必填 ——
  const bookName = text(raw.bookName);
  if (!bookName) {
    push('bookName', '图书名称不能为空');
  } else if (bookName.length > MAX_LENGTH.bookName) {
    push('bookName', `图书名称长度不能超过 ${MAX_LENGTH.bookName} 个字符`);
  }

  // —— 图书类型：必填，且必须真实存在于 book_type 表 ——
  // 防止用户绕过下拉框直接提交一个不存在的类型 id（数据库有外键，会直接报 500）
  const rawType = text(raw.bookType);
  let bookType = null;
  if (!rawType) {
    push('bookType', '图书类型不能为空');
  } else if (!/^\d+$/.test(rawType)) {
    push('bookType', '图书类型不合法');
  } else {
    bookType = Number.parseInt(rawType, 10);
    const exists = await bookTypeModel.existsById(bookType);
    if (!exists) {
      push('bookType', '所选图书类型不存在，请重新选择');
    }
  }

  // —— 作者 / 出版社：选填（图-4 无星号）。
  //    数据库这两列为 NOT NULL，故留空时写入空串兜底，而不是 NULL。 ——
  const bookAuthor = text(raw.bookAuthor);
  if (bookAuthor.length > MAX_LENGTH.bookAuthor) {
    push('bookAuthor', `作者长度不能超过 ${MAX_LENGTH.bookAuthor} 个字符`);
  }

  const publishPress = text(raw.publishPress);
  if (publishPress.length > MAX_LENGTH.publishPress) {
    push('publishPress', `出版社长度不能超过 ${MAX_LENGTH.publishPress} 个字符`);
  }

  // —— 是否借阅：必填，只接受 0 / 1 ——
  const rawBorrowed = text(raw.borrowed);
  let borrowed = null;
  if (rawBorrowed === '') {
    push('borrowed', '请选择是否借阅');
  } else if (rawBorrowed !== '0' && rawBorrowed !== '1') {
    push('borrowed', '是否借阅只能选择「已借阅」或「未借阅」');
  } else {
    borrowed = Number.parseInt(rawBorrowed, 10);
  }

  // —— 入库人：必填。新增加载时页面已预填「系统管理员」——
  const createdBy = text(raw.createdBy) || DEFAULT_CREATED_BY;
  if (!createdBy) {
    push('createdBy', '入库人不能为空');
  } else if (createdBy.length > MAX_LENGTH.createdBy) {
    push('createdBy', `入库人长度不能超过 ${MAX_LENGTH.createdBy} 个字符`);
  }

  // —— 入库时间：必填，格式必须是 年-月-日 ——
  const creationTime = text(raw.creationTime);
  if (!creationTime) {
    push('creationTime', '入库时间不能为空');
  } else if (!DATE_PATTERN.test(creationTime)) {
    push('creationTime', '入库时间格式不正确，应为 年-月-日');
  } else if (Number.isNaN(new Date(`${creationTime}T00:00:00`).getTime())) {
    push('creationTime', '入库时间不是一个有效日期');
  }

  // —— 出版日期：图-4 中没有该字段，所以页面不会传过来；
  //    但数据库列非空，这里补当天日期。表单若传了合法值则优先采用。 ——
  const rawPublishDate = text(raw.publishDate);
  const publishDate = rawPublishDate || todayString();

  return {
    errors,
    data: {
      bookCode,
      bookName,
      bookType,
      bookAuthor,
      publishPress,
      publishDate,
      borrowed,
      createdBy,
      creationTime,
    },
  };
}

/**
 * 新增图书。
 * @param {object} raw 表单原始输入
 * @returns {Promise<{ok: boolean, bookId?: number, errors?: Array, data?: object}>}
 */
async function createBook(raw) {
  const { data, errors } = await validateBookForm(raw);
  if (errors.length > 0) {
    return { ok: false, errors, data };
  }

  const bookId = await bookModel.insert(data);
  return { ok: true, bookId, data };
}

/**
 * 修改图书。
 *
 * 注意：即使用户在表单里篡改了 createdBy / creationTime，
 * 服务层也不会把它们传下去——bookModel.update 的 SET 子句里根本没有这两列。
 *
 * @param {*} bookId
 * @param {object} raw 表单原始输入
 * @returns {Promise<{ok: boolean, errors?: Array, reason?: string, data?: object}>}
 */
async function updateBook(bookId, raw) {
  const id = Number.parseInt(bookId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, reason: '图书 ID 不合法' };
  }

  const { data, errors } = await validateBookForm(raw);
  if (errors.length > 0) {
    return { ok: false, errors, data };
  }

  const affectedRows = await bookModel.update(id, data);
  if (affectedRows === 0) {
    return { ok: false, reason: '该图书不存在或已被删除' };
  }

  return { ok: true, data };
}

/**
 * 删除图书。
 * @param {*} bookId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function deleteBook(bookId) {
  const id = Number.parseInt(bookId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, reason: '图书 ID 不合法' };
  }

  const affectedRows = await bookModel.remove(id);
  if (affectedRows === 0) {
    return { ok: false, reason: '该图书不存在或已被删除' };
  }

  return { ok: true };
}

module.exports = {
  listBooks,
  getBookDetail,
  listBookTypes,
  buildNewFormDefaults,
  validateBookForm,
  createBook,
  updateBook,
  deleteBook,
  todayString,
};
