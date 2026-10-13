'use strict';

/**
 * 功能 6：删除图书，对应原卷图-8（确认框）与图-9（列表页提示）。
 *
 * 两个要点：
 *   1. 必须是 POST。用 GET 删数据意味着浏览器预取或爬虫扫到链接就会误删。
 *   2. 删完要跳回列表页，并明确提示成功或失败。
 */

const request = require('supertest');
const app = require('../app');
const pool = require('../src/config/db');

/** 造一条待删记录，返回它的 bookId */
async function createBook(bookCode) {
  const res = await request(app).post('/books').type('form').send({
    bookCode,
    bookName: '待删除的图书',
    bookType: '1',
    bookAuthor: '测试',
    publishPress: '测试社',
    borrowed: '1',
    createdBy: '系统管理员',
    creationTime: '2024-01-01',
  });
  expect(res.headers.location).toBe('/?msg=create_ok');

  const [rows] = await pool.query(
    'SELECT bookId FROM book_info WHERE bookCode = ? LIMIT 1',
    [bookCode]
  );
  return rows[0].bookId;
}

async function countBooks() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM book_info');
  return rows[0].n;
}

afterEach(async () => {
  await pool.query('DELETE FROM book_info WHERE bookCode LIKE ?', ['BK9%']);
});

describe('功能 6：删除图书', () => {
  test('删除成功 -> 302 跳回列表页并带 delete_ok', async () => {
    const bookId = await createBook('BK900101');

    const res = await request(app).post(`/books/${bookId}/delete`).expect(302);
    expect(res.headers.location).toBe('/?msg=delete_ok');
  });

  test('跳回列表页后显示「删除成功！」', async () => {
    const bookId = await createBook('BK900102');

    await request(app).post(`/books/${bookId}/delete`).expect(302);

    const res = await request(app).get('/?msg=delete_ok').expect(200);
    expect(res.text).toContain('删除成功！');
  });

  test('记录真的从库里消失了，总数回到 12', async () => {
    const bookId = await createBook('BK900103');
    expect(await countBooks()).toBe(13);

    await request(app).post(`/books/${bookId}/delete`).expect(302);

    expect(await countBooks()).toBe(12);
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS n FROM book_info WHERE bookId = ?',
      [bookId]
    );
    expect(rows[0].n).toBe(0);
  });

  test('删除后按编号再也查不到，详情页返回 404', async () => {
    const bookId = await createBook('BK900104');
    await request(app).post(`/books/${bookId}/delete`).expect(302);

    await request(app).get(`/books/${bookId}`).expect(404);
  });

  test('删除不存在的记录 -> 302 带 delete_fail', async () => {
    const res = await request(app).post('/books/999999/delete').expect(302);
    expect(res.headers.location).toBe('/?msg=delete_fail');
  });

  test('删除失败时列表页显示「删除失败！」', async () => {
    await request(app).post('/books/999999/delete').expect(302);

    const res = await request(app).get('/?msg=delete_fail').expect(200);
    expect(res.text).toContain('删除失败！');
  });

  test('重复删除同一条 -> 第二次报失败而不是 500', async () => {
    const bookId = await createBook('BK900105');

    await request(app).post(`/books/${bookId}/delete`).expect(302);
    const second = await request(app).post(`/books/${bookId}/delete`).expect(302);

    expect(second.headers.location).toBe('/?msg=delete_fail');
  });

  test('非法 id（非数字 / 负数）走失败分支而不是 500', async () => {
    for (const id of ['abc', '-1', '0']) {
      const res = await request(app).post(`/books/${id}/delete`).expect(302);
      expect(res.headers.location).toBe('/?msg=delete_fail');
    }
  });

  test('★ 删除只接受 POST，GET 请求不能删数据', async () => {
    const bookId = await createBook('BK900106');
    const before = await countBooks();

    // 路由只注册了 POST，GET 会落到 404 处理器上
    await request(app).get(`/books/${bookId}/delete`).expect(404);

    expect(await countBooks()).toBe(before);
  });

  test('删除后第一页正好补上下一条记录（分页不出现空洞）', async () => {
    const bookId = await createBook('BK900107');
    // 新记录入库时间是今天，按降序排在第 1 页第 1 条
    const before = await request(app).get('/').expect(200);
    expect(before.text).toContain('<td>BK900107</td>');

    await request(app).post(`/books/${bookId}/delete`).expect(302);

    const after = await request(app).get('/').expect(200);
    expect(after.text).not.toContain('<td>BK900107</td>');
    expect(after.text).toContain('<td>BK000023</td>');
  });
});

describe('删除确认框的脚本（图-8）', () => {
  test('列表页引用了删除确认脚本，且文案与原卷一致', async () => {
    const fs = require('fs');
    const path = require('path');

    const script = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'js', 'book-list.js'),
      'utf8'
    );

    expect(script).toContain('确定删除该条图书信息？');
    expect(script).toContain('confirm(');
  });

  test('列表页 HTML 里能加载到该脚本', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.text).toContain('/js/book-list.js');
    expect(res.text).toContain('/vendor/jquery-1.8.3.min.js');
  });
});
