'use strict';

/**
 * 分页计算工具（对应原卷「每页显示五条数据」+ 图-1 的分页条）。
 *
 * 图-1 的分页条形如：
 *   上一页 ◀ 1 2 3 4 5 6 7 8 9 ▶ 下一页   共100页 到第[ ]页 [确定]
 * 即页码以「滑动窗口」方式显示，最多 9 个页码。
 */

/** 分页条上最多同时显示多少个页码（对齐图-1 的 1~9） */
const PAGE_WINDOW = 9;

/**
 * 把任意输入规整成合法的页码（从 1 开始）。
 * 用户可能手输 page=abc / -1 / 0，或直接篡改 URL，这里统一兜底为 1。
 * @param {*} value
 * @returns {number}
 */
function normalizePage(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * 计算分页所需的全部派生信息，供路由与视图直接使用。
 *
 * @param {object} options
 * @param {number} options.total    符合条件的总记录数
 * @param {number} options.page     当前页（1 开始）
 * @param {number} options.pageSize 每页条数
 * @returns {{
 *   total: number, page: number, pageSize: number, totalPages: number,
 *   pages: number[], hasPrev: boolean, hasNext: boolean,
 *   offset: number, startRow: number, endRow: number
 * }}
 */
function buildPagination({ total, page, pageSize }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 5);

  // 总页数至少为 1，这样「查无结果」时也能显示「共 1 页」而不是「共 0 页」（对齐图-2）
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));

  // 记录被删掉后当前页可能越界，钳制回最后一页
  const currentPage = Math.min(Math.max(1, normalizePage(page)), totalPages);

  // 以当前页为中心的滑动窗口，窗口贴着首尾时不越界
  const half = Math.floor(PAGE_WINDOW / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  start = Math.max(1, end - PAGE_WINDOW + 1);

  const pages = [];
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  const offset = (currentPage - 1) * safePageSize;

  return {
    total: safeTotal,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
    pages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    offset,
    // 「当前显示第 X 条到第 Y 条」，共 0 条时显示 0-0
    startRow: safeTotal === 0 ? 0 : offset + 1,
    endRow: Math.min(offset + safePageSize, safeTotal),
  };
}

module.exports = { buildPagination, normalizePage, PAGE_WINDOW };
