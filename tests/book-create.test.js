'use strict';

/**
 * 功能 4：新增图书，对应原卷图-4 / 图-5。
 *
 * 这里刻意**绕过前端**直接 POST：
 * 前端 jQuery 校验只是体验优化，禁用 JS 或直接构造请求都能绕过它，
 * 所以服务端必须能独立挡住这些脏数据。这正是本文件要证明的事。
 */

const request = require('supertest');
const app = require('../app');
const pool = require('../src/config/db');
const { todayString } = require('../src/services/bookService');

/** 一条合法的新增表单数据 */
const VALID_FORM = {
  bookCode: 'BK900001',
  bookName: '测试用图书',
  bookType: '3',
  bookAuthor: '测试作者',
  publishPress: '测试出版社',
  borrowed: '0',
  createdBy: '系统管理员',
  creationTime: '2024-05-06',
};

/** 按图书编号取库里的原始行，用来断言「数据库里到底存了什么」 */
async function findRawByCode(bookCode) {
  const [rows] = await pool.query(
    'SELECT * FROM book_info WHERE bookCode = ? LIMIT 1',
    [bookCode]
  );
  return rows[0] || null;
}

afterEach(async () => {
  // 本文件新增的记录统一清掉，避免影响其它文件（虽然每个文件前都会重导种子数据）
  await pool.query('DELETE FROM book_info WHERE bookCode LIKE ?', ['BK9%']);
});

describe('功能 4：打开新增页（图-4）', () => {
  test('页面标题与 6 个必填星号', async () => {
    const res = await request(app).get('/books/new').expect(200);

    expect(res.text).toContain('新增图书信息');
    expect((res.text.match(/class="required-mark">\*</g) || [])).toHaveLength(6);
  });

  test('★ 图书类型下拉框的选项必须来自 book_type 表', async () => {
    const res = await request(app).get('/books/new').expect(200);

    const [types] = await pool.query('SELECT id, typeName FROM book_type ORDER BY id');
    expect(types).toHaveLength(8);

    for (const type of types) {
      // 每个类型都要在下拉框里出现，且 value 用的是数据库里的真实 id
      expect(res.text).toContain(`<option value="${type.id}"`);
      expect(res.text).toContain(type.typeName);
    }

    // 默认停在「——请选择——」，类型下拉框里不能有任何一项被预选
    expect(res.text).toContain('<option value="">——请选择——</option>');
    const typeSelect = /<select[^>]*id="bookType"[\s\S]*?<\/select>/.exec(res.text)[0];
    expect(typeSelect).not.toMatch(/<option value="\d+"[^>]*selected/);
  });

  test('入库人预填「系统管理员」', async () => {
    const res = await request(app).get('/books/new').expect(200);

    expect(res.text).toMatch(/id="createdBy"[\s\S]*?value="系统管理员"/);
  });

  test('入库时间预填当天，且格式是 年-月-日', async () => {
    const res = await request(app).get('/books/new').expect(200);

    const today = todayString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.text).toMatch(new RegExp(`id="creationTime"[\\s\\S]*?value="${today}"`));
    // 不能是 type=date：中文 Chrome 会把 2024-05-06 显示成 2024/05/06，与原卷图-4 不符
    expect(res.text).toMatch(/type="text" id="creationTime"/);
  });

  test('是否借阅默认「未借阅」，作者与出版社没有星号', async () => {
    const res = await request(app).get('/books/new').expect(200);

    expect(res.text).toMatch(/<option value="0" selected>未借阅<\/option>/);
    expect(res.text).toMatch(/<option value="1" >已借阅<\/option>/);
    // 新增页所有字段都应可编辑，不应出现 readonly
    expect(res.text).not.toMatch(/readonly \/>/);
  });
});

describe('功能 4：提交新增（图-5）', () => {
  test('合法数据 -> 302 跳回列表页并带 create_ok', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send(VALID_FORM)
      .expect(302);

    expect(res.headers.location).toBe('/?msg=create_ok');
  });

  test('跳回列表页后显示「新增成功！」', async () => {
    await request(app).post('/books').type('form').send(VALID_FORM).expect(302);

    const res = await request(app).get('/?msg=create_ok').expect(200);
    expect(res.text).toContain('新增成功！');
  });

  test('★ 数据真的落库了，字段与表单一致', async () => {
    await request(app).post('/books').type('form').send(VALID_FORM).expect(302);

    const row = await findRawByCode('BK900001');
    expect(row).not.toBeNull();
    expect(row.bookName).toBe('测试用图书');
    expect(row.bookType).toBe(3);
    expect(row.bookAuthor).toBe('测试作者');
    expect(row.publishPress).toBe('测试出版社');
    expect(row.borrowed).toBe(0);
    expect(row.creationTime).toMatch(/^2024-05-06/);
    // 新增时还没改过，lastUpdateTime 应为空
    expect(row.lastUpdateTime).toBeNull();
  });

  test('★ 表单里没有「出版日期」字段，由后端自动补当天', async () => {
    await request(app).post('/books').type('form').send(VALID_FORM).expect(302);

    const row = await findRawByCode('BK900001');
    expect(row).not.toBeNull();
    // publishDate 是 DATE 列；dateStrings:true 下取到的是 'YYYY-MM-DD'
    expect(String(row.publishDate).slice(0, 10)).toBe(todayString());
  });

  test('★ 未提交入库人时兜底为「系统管理员」（原卷不实现登录）', async () => {
    const form = { ...VALID_FORM, bookCode: 'BK900002' };
    delete form.createdBy;

    await request(app).post('/books').type('form').send(form).expect(302);

    const row = await findRawByCode('BK900002');
    expect(row.createdBy).toBe('系统管理员');
  });

  test('作者 / 出版社留空时写入空串而不是 NULL（数据库列为 NOT NULL）', async () => {
    const form = { ...VALID_FORM, bookCode: 'BK900003', bookAuthor: '', publishPress: '' };

    await request(app).post('/books').type('form').send(form).expect(302);

    const row = await findRawByCode('BK900003');
    expect(row.bookAuthor).toBe('');
    expect(row.publishPress).toBe('');
  });

  test('新记录出现在按名称查询的结果里（功能 4 与功能 2 打通）', async () => {
    await request(app).post('/books').type('form').send(VALID_FORM).expect(302);

    const res = await request(app).get('/').query({ name: '测试用图书' }).expect(200);
    expect(res.text).toContain('<td>BK900001</td>');
  });
});

describe('功能 4：服务端校验（前端被绕过时的兜底）', () => {
  test('图书编号与名称都为空 -> 400，且逐字段给出提示', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookCode: '', bookName: '' })
      .expect(400);

    expect(res.text).toContain('图书编号不能为空');
    expect(res.text).toContain('图书名称不能为空');
    expect(res.text).toContain('新增失败！');
    // 校验失败不能跳转，否则用户填的内容就丢了
    expect(res.headers.location).toBeUndefined();
  });

  test('校验失败时回显用户已填的内容', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookName: '' })
      .expect(400);

    expect(res.text).toContain('value="BK900001"');
    expect(res.text).toContain('value="测试出版社"');
  });

  test('★ 伪造一个 book_type 里不存在的类型 id -> 被服务端挡住', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookType: '999' })
      .expect(400);

    expect(res.text).toContain('所选图书类型不存在，请重新选择');
    expect(await findRawByCode('BK900001')).toBeNull();
  });

  test('图书类型传非数字 -> 被挡住', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookType: 'abc' })
      .expect(400);

    expect(res.text).toContain('图书类型不合法');
  });

  test.each([
    ['2014-13-45', '入库时间不是一个有效日期'],
    ['2014/03/12', '入库时间格式不正确'],
    ['', '入库时间不能为空'],
    // ★ 下面这三个是回归用例：它们能通过正则，「new Date() 判 NaN」也拦不住
    //   （JS 会把 2014-02-30 自动进位成 2014-03-02），曾经会一路写库失败变 500。
    ['2014-02-30', '入库时间不是一个有效日期'],
    ['2014-04-31', '入库时间不是一个有效日期'],
    ['2015-02-29', '入库时间不是一个有效日期'],
  ])('入库时间 %p -> 被挡住', async (value, message) => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, creationTime: value })
      .expect(400);

    expect(res.text).toContain(message);
  });

  test.each(['2016-02-29', '2014-03-12', '2024-12-31'])(
    '真实存在的日期 %p 应当保存成功（含闰日）',
    async (value) => {
      const res = await request(app)
        .post('/books')
        .type('form')
        .send({ ...VALID_FORM, creationTime: value })
        .expect(302);

      expect(res.headers.location).toBe('/?msg=create_ok');
    }
  );

  test('是否借阅传 0/1 之外的值 -> 被挡住', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, borrowed: '2' })
      .expect(400);

    expect(res.text).toContain('是否借阅只能选择');
  });

  test('超长字段被挡在数据库之前（避免 VARCHAR 截断或报错）', async () => {
    const res = await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookName: 'x'.repeat(101) })
      .expect(400);

    expect(res.text).toContain('图书名称长度不能超过 100 个字符');
  });

  test('校验失败时不会残留半条记录', async () => {
    await request(app)
      .post('/books')
      .type('form')
      .send({ ...VALID_FORM, bookType: '999' })
      .expect(400);

    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM book_info');
    expect(rows[0].n).toBe(12);
  });
});
