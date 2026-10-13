'use strict';

/**
 * 分页算法单元测试（不连数据库）。
 *
 * 分页条是原卷图-1 的一部分（`1 2 3 4 5 6 7 8 9`），
 * 而「滑动窗口」这段逻辑在种子数据只有 12 条（3 页）时根本走不到边界，
 * 所以这里把边界情况单独用单元测试钉死。
 */

const {
  buildPagination,
  normalizePage,
  PAGE_WINDOW,
} = require('../src/utils/pagination');

describe('normalizePage —— 把用户在地址栏乱填的页码兜底成合法值', () => {
  test.each([
    ['3', 3],
    [3, 3],
    ['abc', 1],
    ['', 1],
    [undefined, 1],
    [null, 1],
    ['0', 1],
    ['-1', 1],
    ['1.9', 1],
    [' 5 ', 5],
  ])('normalizePage(%p) === %p', (input, expected) => {
    expect(normalizePage(input)).toBe(expected);
  });
});

describe('buildPagination —— 总页数与页码窗口', () => {
  test('查无结果时仍显示「共 1 页」，且没有上下页（对齐图-2）', () => {
    const p = buildPagination({ total: 0, page: 1, pageSize: 5 });

    expect(p.totalPages).toBe(1);
    expect(p.pages).toEqual([1]);
    expect(p.hasPrev).toBe(false);
    expect(p.hasNext).toBe(false);
    // 共 0 条时「第 X 条到第 Y 条」显示 0-0 而不是 1-0
    expect(p.startRow).toBe(0);
    expect(p.endRow).toBe(0);
    expect(p.offset).toBe(0);
  });

  test('57 条 / 每页 5 条 = 12 页', () => {
    const p = buildPagination({ total: 57, page: 1, pageSize: 5 });
    expect(p.totalPages).toBe(12);
  });

  test('第 1 页显示 1~9，且没有上一页（对齐图-1 的 1 2 3 4 5 6 7 8 9）', () => {
    const p = buildPagination({ total: 57, page: 1, pageSize: 5 });

    expect(p.pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(p.pages).toHaveLength(PAGE_WINDOW);
    expect(p.hasPrev).toBe(false);
    expect(p.hasNext).toBe(true);
    expect(p.offset).toBe(0);
    expect(p.startRow).toBe(1);
    expect(p.endRow).toBe(5);
  });

  test('窗口还没滑到末尾时起点仍是 1（第 5 页）', () => {
    const p = buildPagination({ total: 57, page: 5, pageSize: 5 });
    expect(p.pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('窗口滑到中间时以当前页为中心（第 7 页 -> 3~11）', () => {
    const p = buildPagination({ total: 57, page: 7, pageSize: 5 });
    expect(p.pages).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test('末页窗口贴住右边界（第 12 页 -> 4~12），且没有下一页', () => {
    const p = buildPagination({ total: 57, page: 12, pageSize: 5 });

    expect(p.pages).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(true);
    expect(p.offset).toBe(55);
    expect(p.startRow).toBe(56);
    expect(p.endRow).toBe(57);
  });

  test('页码越界时钳制回最后一页（记录被删光的典型场景）', () => {
    const p = buildPagination({ total: 57, page: 999, pageSize: 5 });

    expect(p.page).toBe(12);
    expect(p.offset).toBe(55);
  });

  test('页码小于 1 时钳制回第 1 页', () => {
    const p = buildPagination({ total: 57, page: 0, pageSize: 5 });
    expect(p.page).toBe(1);
  });

  test('总页数不足一个窗口时不补空页码（3 页就只显示 1 2 3）', () => {
    const p = buildPagination({ total: 12, page: 1, pageSize: 5 });

    expect(p.totalPages).toBe(3);
    expect(p.pages).toEqual([1, 2, 3]);
  });

  test('末页不满一页时 endRow 取实际条数（12 条的第 3 页只有 2 条）', () => {
    const p = buildPagination({ total: 12, page: 3, pageSize: 5 });

    expect(p.startRow).toBe(11);
    expect(p.endRow).toBe(12);
    expect(p.hasNext).toBe(false);
  });
});
