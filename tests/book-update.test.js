'use strict';

/**
 * 功能 5：修改图书，对应原卷图-6 / 图-7。
 *
 * ★ 本文件的重点是**防篡改回归**：
 *   原卷要求修改页的「入库人」「入库时间」只读、不可修改。
 *   前端的 readonly 属性只是提示——用户按 F12 删掉它，或者用 curl 直接 POST，
 *   就能提交任意值。所以真正的保证必须在 SQL 层：
 *   bookModel.update 的 SET 子句里根本没有 createdBy / creationTime 两列。
 *   下面的用例就是模拟「前端被绕过」的场景，确保这两列纹丝不动。
 */

const request = require('supertest');
const app = require('../app');
const pool = require('../src/config/db');

/**
 * 种子数据里 bookId=3 是「BK000025 天龙八部 / 金庸 / 系统管理员 / 2014-03-12」，
 * 它的 bookType 是 1（小说）——注意 bookId 和 bookType 是两回事。
 */
const SEED_ID = 3;
const SEED_TYPE_ID = '1';

/**
 * 一份合法的修改表单。
 * createdBy / creationTime 也一并提交：真实页面上它们是 readonly 输入框，
 * readonly 与 disabled 不同，**仍会随表单提交**，
 * 所以服务端每次都能收到这两个值，只是 UPDATE 语句不用它们而已。
 */
const VALID_FORM = {
  bookCode: 'BK000025',
  bookName: '天龙八部（修订版）',
  bookType: SEED_TYPE_ID,
  bookAuthor: '金庸',
  publishPress: '中原出版社',
  borrowed: '0',
  createdBy: '系统管理员',
  creationTime: '2014-03-12',
};

async function findRaw(bookId) {
  const [rows] = await pool.query(
    'SELECT * FROM book_info WHERE bookId = ? LIMIT 1',
    [bookId]
  );
  return rows[0] || null;
}

describe('功能 5：打开修改页（图-6）', () => {
  test('入库人 / 入库时间两栏带 readonly，其余字段可编辑', async () => {
    const res = await request(app).get(`/books/${SEED_ID}/edit`).expect(200);

    expect(res.text).toContain('修改图书信息');
    // 有且仅有这两栏是只读的
    expect((res.text.match(/readonly \/>/g) || [])).toHaveLength(2);
    expect(res.text).toMatch(/id="createdBy"[\s\S]*?readonly \/>/);
    expect(res.text).toMatch(/id="creationTime"[\s\S]*?readonly \/>/);
  });

  test('其余 6 个字段可编辑（提交时才能被保存）', async () => {
    const res = await request(app).get(`/books/${SEED_ID}/edit`).expect(200);

    for (const id of ['bookCode', 'bookName', 'bookAuthor', 'publishPress']) {
      const input = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(res.text);
      expect(input).not.toBeNull();
      expect(input[0]).not.toContain('readonly');
    }
  });

  test('表单回填原记录的值，且类型下拉选中当前类型', async () => {
    const res = await request(app).get(`/books/${SEED_ID}/edit`).expect(200);

    expect(res.text).toContain('value="BK000025"');
    expect(res.text).toContain('value="天龙八部"');
    expect(res.text).toContain('value="金庸"');
    // 天龙八部的 bookType 是 1（小说），修改页要把这一项选中
    expect(res.text).toMatch(new RegExp(`<option value="${SEED_TYPE_ID}"\\s+selected>`));
  });

  test('提交地址指向当前记录（不是新增接口）', async () => {
    const res = await request(app).get(`/books/${SEED_ID}/edit`).expect(200);

    expect(res.text).toContain(`action="/books/${SEED_ID}"`);
    expect(res.text).toContain('<button class="btn btn-submit" type="submit">修改</button>');
  });

  test('修改不存在的记录返回 404', async () => {
    const res = await request(app).get('/books/999999/edit').expect(404);
    expect(res.text).toContain('图书不存在');
  });
});

describe('功能 5：提交修改（图-7）', () => {
  test('合法数据 -> 302 跳回列表页并带 update_ok', async () => {
    const res = await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send(VALID_FORM)
      .expect(302);

    expect(res.headers.location).toBe('/?msg=update_ok');
  });

  test('跳回列表页后显示「修改成功！」', async () => {
    await request(app).post(`/books/${SEED_ID}`).type('form').send(VALID_FORM).expect(302);

    const res = await request(app).get('/?msg=update_ok').expect(200);
    expect(res.text).toContain('修改成功！');
  });

  test('改动确实写进了数据库', async () => {
    await request(app).post(`/books/${SEED_ID}`).type('form').send(VALID_FORM).expect(302);

    const row = await findRaw(SEED_ID);
    expect(row.bookName).toBe('天龙八部（修订版）');
    expect(row.bookAuthor).toBe('金庸');
  });

  test('修改后详情页显示的是新值', async () => {
    await request(app).post(`/books/${SEED_ID}`).type('form').send(VALID_FORM).expect(302);

    const res = await request(app).get(`/books/${SEED_ID}`).expect(200);
    expect(res.text).toContain('value="天龙八部（修订版）"');
  });

  test('修改不存在的记录 -> 回列表页提示「修改失败！」', async () => {
    const res = await request(app)
      .post('/books/999999')
      .type('form')
      .send({ ...VALID_FORM, bookCode: 'BK999999' })
      .expect(302);

    expect(res.headers.location).toBe('/?msg=update_fail');

    const list = await request(app).get('/?msg=update_fail').expect(200);
    expect(list.text).toContain('修改失败！');
  });
});

describe('★ 防篡改回归：入库人 / 入库时间不可被绕过修改', () => {
  const before = { createdBy: '系统管理员', creationTime: '2014-03-12' };

  test('前提：种子记录的入库人与入库时间确实是预置值', async () => {
    const row = await findRaw(SEED_ID);
    expect(row.createdBy).toBe(before.createdBy);
    expect(String(row.creationTime)).toMatch(/^2014-03-12/);
  });

  test('伪造 POST 提交 createdBy / creationTime，数据库里必须纹丝不动', async () => {
    await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send({
        ...VALID_FORM,
        // 模拟用户改掉 HTML 里 readonly 属性后提交的伪造值
        createdBy: '黑客',
        creationTime: '1999-01-01',
      })
      .expect(302);

    const row = await findRaw(SEED_ID);
    expect(row.createdBy).toBe(before.createdBy);
    expect(String(row.creationTime)).toMatch(/^2014-03-12/);
  });

  test('同一请求里其它字段确实被更新了（证明 UPDATE 真的执行过，不是整个失败）', async () => {
    await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send({
        ...VALID_FORM,
        bookName: '被改过的书名',
        createdBy: '黑客',
        creationTime: '1999-01-01',
      })
      .expect(302);

    const row = await findRaw(SEED_ID);
    expect(row.bookName).toBe('被改过的书名');
    expect(row.createdBy).toBe(before.createdBy);
  });

  test('修改页回填的仍是原始入库人 / 入库时间（界面上也看不到伪造值）', async () => {
    await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send({ ...VALID_FORM, createdBy: '黑客', creationTime: '1999-01-01' })
      .expect(302);

    const res = await request(app).get(`/books/${SEED_ID}/edit`).expect(200);
    expect(res.text).toMatch(/id="createdBy"[\s\S]*?value="系统管理员"/);
    expect(res.text).toMatch(/id="creationTime"[\s\S]*?value="2014-03-12"/);
    expect(res.text).not.toContain('黑客');
    expect(res.text).not.toContain('1999-01-01');
  });

  test('★ lastUpdateTime 被更新为当前时间（原卷「最新更新时间」字段的用途）', async () => {
    await request(app).post(`/books/${SEED_ID}`).type('form').send(VALID_FORM).expect(302);

    const afterRow = await findRaw(SEED_ID);
    // 新增时该列是 NULL（见 book-create.test.js），第一次修改后才会有值
    expect(afterRow.lastUpdateTime).not.toBeNull();

    // 与数据库当前时间对比，允许几秒误差
    const [[{ diff }]] = await pool.query(
      'SELECT ABS(TIMESTAMPDIFF(SECOND, lastUpdateTime, NOW())) AS diff FROM book_info WHERE bookId = ?',
      [SEED_ID]
    );
    expect(diff).toBeLessThan(30);
  });
});

describe('功能 5：修改时的服务端校验', () => {
  test('必填为空 -> 400 并回显错误', async () => {
    const res = await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send({ ...VALID_FORM, bookName: '' })
      .expect(400);

    expect(res.text).toContain('图书名称不能为空');
    expect(res.text).toContain('修改失败！');
  });

  test('校验失败时数据库保持原样', async () => {
    // 前面的用例已经改过这条记录，所以先取当前值，再验证被拒绝的请求没有动它
    const before = await findRaw(SEED_ID);

    await request(app)
      .post(`/books/${SEED_ID}`)
      .type('form')
      .send({ ...VALID_FORM, bookName: '', bookType: '999' })
      .expect(400);

    const after = await findRaw(SEED_ID);
    expect(after.bookName).toBe(before.bookName);
    expect(after.bookType).toBe(before.bookType);
    expect(String(after.lastUpdateTime)).toBe(String(before.lastUpdateTime));
  });

  test('非法 id 直接判失败，不触碰数据库', async () => {
    const res = await request(app)
      .post('/books/abc')
      .type('form')
      .send(VALID_FORM)
      .expect(302);

    expect(res.headers.location).toBe('/?msg=update_fail');
  });
});
