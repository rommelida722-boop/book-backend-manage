'use strict';

/**
 * 图书类型表 book_type 的数据访问对象（DAO）。
 *
 * 原卷明确要求：新增 / 修改页的「图书类型」下拉框，
 * 具体类型数据**必须来源于图书类型表 book_type**，不得在页面里写死。
 */

const pool = require('../config/db');

/**
 * 查询全部图书类型，按 id 升序（即原卷列出的 小说、文学、传记… 顺序）。
 * @returns {Promise<Array<{id: number, typeName: string}>>}
 */
async function findAll() {
  const [rows] = await pool.query(
    'SELECT id, typeName FROM book_type ORDER BY id ASC'
  );
  return rows;
}

/**
 * 判断某个图书类型 id 是否存在。
 * 用于服务端校验：防止用户绕过下拉框，直接 POST 一个不存在的 bookType。
 * @param {number} id
 * @returns {Promise<boolean>}
 */
async function existsById(id) {
  const [rows] = await pool.query(
    'SELECT 1 FROM book_type WHERE id = ? LIMIT 1',
    [id]
  );
  return rows.length > 0;
}

module.exports = { findAll, existsById };
