'use strict';

/**
 * 图书信息表 book_info 的数据访问对象（DAO）。
 *
 * 分层说明（对齐原卷「创建数据访问层 DAO 接口及其实现类」的要求）：
 * 本文件只负责拼 SQL 与取数据，不掺业务规则；业务规则放在 services/bookService.js。
 *
 * 安全约定：整个文件的所有外部输入一律通过 `?` 占位符传参，
 * 不使用字符串拼接，避免 SQL 注入。
 */

const pool = require('../config/db');

/** 详情 / 修改页需要的完整字段（含图书类型名称） */
const DETAIL_COLUMNS = `
  b.bookId,
  b.bookCode,
  b.bookName,
  b.bookType,
  b.bookAuthor,
  b.publishPress,
  DATE_FORMAT(b.publishDate, '%Y-%m-%d')    AS publishDateText,
  b.borrowed,
  b.createdBy,
  DATE_FORMAT(b.creationTime, '%Y-%m-%d')   AS creationTimeText,
  b.lastUpdateTime,
  t.typeName
`;

/**
 * 转义 LIKE 通配符。
 *
 * 用户如果把 `%` 或 `_` 输进查询框（例如书名里真的有下划线），
 * 不过滤就会被当成通配符，导致「查 A_1 却匹配到 AB1」这类错误结果。
 * MySQL 默认转义符是反斜杠，故在前面补 `\`。
 * @param {string} value
 * @returns {string}
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * 拼出「按图书名称模糊查询」的 WHERE 子句与参数。
 * 抽成函数是为了让列表查询与总数统计**共用同一套条件**，
 * 否则「共 N 页」会和实际列表对不上。
 * @param {string} name
 * @returns {{ clause: string, params: string[] }}
 */
function buildNameFilter(name) {
  if (!name) {
    return { clause: '', params: [] };
  }
  return { clause: 'WHERE b.bookName LIKE ?', params: [`%${escapeLike(name)}%`] };
}

/**
 * 分页查询图书列表。
 *
 * 原卷要求：默认显示全部图书，按入库时间降序；支持按图书名称模糊查询。
 * 入库时间在 SQL 层就用 DATE_FORMAT 转成「年-月-日」，
 * 因为直接把 DATETIME 交给页面渲染会带上 T 和时区。
 *
 * @param {object} options
 * @param {string} options.name   图书名称模糊查询条件，空串表示不筛
 * @param {number} options.limit  每页条数
 * @param {number} options.offset 偏移量
 * @returns {Promise<Array<object>>}
 */
async function findPage({ name, limit, offset }) {
  const { clause, params } = buildNameFilter(name);

  const [rows] = await pool.query(
    `SELECT b.bookId,
            b.bookCode,
            b.bookName,
            b.bookAuthor,
            b.publishPress,
            DATE_FORMAT(b.creationTime, '%Y-%m-%d') AS creationTimeText,
            b.borrowed,
            t.typeName
       FROM book_info b
       LEFT JOIN book_type t ON t.id = b.bookType
       ${clause}
      ORDER BY b.creationTime DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
}

/**
 * 统计符合条件的图书总数，用于算总页数与分页条。
 * @param {string} name 图书名称模糊查询条件
 * @returns {Promise<number>}
 */
async function countAll(name) {
  const { clause, params } = buildNameFilter(name);

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM book_info b
       ${clause}`,
    params
  );

  return Number(rows[0].total) || 0;
}

/**
 * 按主键查询单本图书（查看详情 / 修改页回填用）。
 * @param {number} bookId
 * @returns {Promise<object|null>} 找不到返回 null
 */
async function findById(bookId) {
  const [rows] = await pool.query(
    `SELECT ${DETAIL_COLUMNS}
       FROM book_info b
       LEFT JOIN book_type t ON t.id = b.bookType
      WHERE b.bookId = ?
      LIMIT 1`,
    [bookId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 新增图书。
 *
 * 说明：表单里没有「出版日期」字段（原卷图-4 确实没有），
 * 但 book_info.publishDate 是非空列，故由服务层补一个当天日期传进来。
 *
 * @param {object} data 已通过校验的数据
 * @returns {Promise<number>} 新记录的 bookId
 */
async function insert(data) {
  const [result] = await pool.query(
    `INSERT INTO book_info
       (bookCode, bookName, bookType, bookAuthor, publishPress,
        publishDate, borrowed, createdBy, creationTime, lastUpdateTime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      data.bookCode,
      data.bookName,
      data.bookType,
      data.bookAuthor,
      data.publishPress,
      data.publishDate,
      data.borrowed,
      data.createdBy,
      data.creationTime,
    ]
  );

  return result.insertId;
}

/**
 * 修改图书。
 *
 * ★ 关键：SET 子句里**刻意不包含 createdBy 与 creationTime**。
 *   原卷要求这两项在修改页为只读状态、不可修改；前端 readonly 只是提示，
 *   用户仍可改 HTML 或直接 POST 绕过。只在 SQL 层不更新它们，
 *   才是真正的防篡改。
 *   同时把 lastUpdateTime 置为当前时间，对应原卷「最新更新时间」字段的用途。
 *
 * @param {number} bookId
 * @param {object} data 已通过校验的数据
 * @returns {Promise<number>} 受影响行数，0 表示记录不存在
 */
async function update(bookId, data) {
  const [result] = await pool.query(
    `UPDATE book_info
        SET bookCode       = ?,
            bookName       = ?,
            bookType       = ?,
            bookAuthor     = ?,
            publishPress   = ?,
            borrowed       = ?,
            lastUpdateTime = NOW()
      WHERE bookId = ?`,
    [
      data.bookCode,
      data.bookName,
      data.bookType,
      data.bookAuthor,
      data.publishPress,
      data.borrowed,
      bookId,
    ]
  );

  return result.affectedRows;
}

/**
 * 删除图书。
 * @param {number} bookId
 * @returns {Promise<number>} 受影响行数，0 表示记录不存在
 */
async function remove(bookId) {
  const [result] = await pool.query(
    'DELETE FROM book_info WHERE bookId = ?',
    [bookId]
  );

  return result.affectedRows;
}

module.exports = {
  findPage,
  countAll,
  findById,
  insert,
  update,
  remove,
};
