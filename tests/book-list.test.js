'use strict';

/**
 * 功能 1（图书列表）、功能 2（按名称模糊查询）、功能 3（查看详情）
 * 打真库的集成测试，对应原卷图-1 / 图-2 / 图-3。
 */

const request = require('supertest');
const app = require('../app');

/**
 * 取出列表页「操作」列里的图书 id。
 * 查看链接形如 /books/3 或 /books/3?name=xx，
 * 修改链接形如 /books/3/edit?...，用 (?:[?"]) 把后者排除掉。
 */
function listBookIds(html) {
  return [...html.matchAll(/href="\/books\/(\d+)(?:[?"])/g)].map((m) => Number(m[1]));
}

/** 取出列表页每一行的入库时间，用于验证排序 */
function listCreationTimes(html) {
  return [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)].map((m) => m[1]);
}

/** 取出所有数据行的图书编号 */
function listBookCodes(html) {
  return [...html.matchAll(/<td>(BK\d+)<\/td>/g)].map((m) => m[1]);
}

describe('功能 1：图书列表（图-1）', () => {
  test('首页返回 200 且渲染出完整表头与标题', async () => {
    const res = await request(app).get('/').expect(200);

    expect(res.text).toContain('图书借阅系统-后台管理');
    for (const header of [
      '图书编号', '图书分类', '图书名称', '作者',
      '出版社', '入库时间', '是否借阅', '操作',
    ]) {
      expect(res.text).toContain(`<th>${header}</th>`);
    }
  });

  test('每页 5 条，共 3 页（12 条种子数据）', async () => {
    const res = await request(app).get('/').expect(200);

    expect(listBookIds(res.text)).toHaveLength(5);
    expect(res.text).toContain('共3页');
  });

  test('按入库时间降序排列，且入库时间已格式化为 年-月-日', async () => {
    const res = await request(app).get('/').expect(200);

    const times = listCreationTimes(res.text);
    expect(times).toHaveLength(5);
    // 原卷要求「按入库时间降序」，所以相邻两项必然满足前面 >= 后面
    const sorted = [...times].sort().reverse();
    expect(times).toEqual(sorted);

    // 不能出现 ISO 串或带斜杠的格式（datetime 直接渲染会变成 2014-07-03T00:00:00.000Z）
    times.forEach((t) => expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(res.text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('第一页内容与原卷图-1 一致（前 5 条）', async () => {
    const res = await request(app).get('/').expect(200);

    expect(listBookCodes(res.text)).toEqual([
      'BK000023', 'BK000024', 'BK000025', 'BK000026', 'BK000027',
    ]);
    // 图-1 里显示的是中文，不是 0/1
    expect(res.text).toContain('<td>未借阅</td>');
    expect(res.text).toContain('<td>已借阅</td>');
  });

  test('隔行变色：第 2、4 行带 row-alt', async () => {
    const res = await request(app).get('/').expect(200);

    const rows = [...res.text.matchAll(/<tr class="([^"]*)">/g)].map((m) => m[1]);
    expect(rows).toEqual(['', 'row-alt', '', 'row-alt', '']);
  });

  test('每行都有 查看 / 修改 / 删除 三个入口', async () => {
    const res = await request(app).get('/').expect(200);

    expect((res.text.match(/>查看</g) || [])).toHaveLength(5);
    expect((res.text.match(/>修改</g) || [])).toHaveLength(5);
    expect((res.text.match(/>删除</g) || [])).toHaveLength(5);
  });

  test('删除入口必须是 POST 表单，不能是 GET 链接', async () => {
    const res = await request(app).get('/').expect(200);

    expect(res.text).toMatch(/<form class="inline-form" method="post"\s+action="\/books\/\d+\/delete">/);
    // 页面里不应存在能直接触发删除的 a[href]
    expect(res.text).not.toMatch(/href="\/books\/\d+\/delete"/);
  });

  test('第 2 页取到第 6~10 条', async () => {
    const res = await request(app).get('/?page=2').expect(200);

    expect(listBookCodes(res.text)).toEqual([
      'BK000028', 'BK000029', 'BK000030', 'BK000031', 'BK000032',
    ]);
  });

  test('末页只显示剩下的 2 条', async () => {
    const res = await request(app).get('/?page=3').expect(200);

    expect(listBookCodes(res.text)).toEqual(['BK000033', 'BK000034']);
  });

  test('页码越界时回落到末页而不是报错', async () => {
    const res = await request(app).get('/?page=999').expect(200);

    expect(listBookCodes(res.text)).toEqual(['BK000033', 'BK000034']);
    expect(res.text).toContain('<span class="page-num is-current">3</span>');
  });

  test('page 传入非数字也不会 500', async () => {
    const res = await request(app).get('/?page=abc').expect(200);
    expect(listBookCodes(res.text)).toHaveLength(5);
  });
});

describe('功能 2：按图书名称模糊查询（图-2）', () => {
  test('精确书名只命中 1 条，且共 1 页', async () => {
    const res = await request(app)
      .get('/')
      .query({ name: '天龙八部' })
      .expect(200);

    expect(listBookCodes(res.text)).toEqual(['BK000025']);
    expect(res.text).toContain('共1页');
  });

  test('输入框回填上次的查询条件（原卷「输入框能够记忆查询的条件」）', async () => {
    const res = await request(app)
      .get('/')
      .query({ name: '天龙八部' })
      .expect(200);

    expect(res.text).toMatch(/name="name"\s+value="天龙八部"/);
  });

  test('支持部分匹配（只输「天」也能查到「天龙八部」）', async () => {
    const res = await request(app).get('/').query({ name: '天' }).expect(200);

    expect(listBookCodes(res.text)).toEqual(['BK000025']);
  });

  test('查无结果时显示空行提示，且仍是「共 1 页」而不是「共 0 页」', async () => {
    const res = await request(app)
      .get('/')
      .query({ name: '这本书根本不存在' })
      .expect(200);

    expect(listBookCodes(res.text)).toHaveLength(0);
    expect(res.text).toContain('没有查询到符合条件的图书');
    expect(res.text).toContain('共1页');
    // 查询条件仍要回填，否则用户会以为查询没生效
    expect(res.text).toContain('value="这本书根本不存在"');
  });

  test('LIKE 通配符被转义：输入 % 不会命中全部记录', async () => {
    const res = await request(app).get('/').query({ name: '%' }).expect(200);

    // 没有书名里含字面量 %，所以应当是 0 条；
    // 若未转义，`%` 会变成「匹配任意字符」，这里就会返回 5 条
    expect(listBookCodes(res.text)).toHaveLength(0);
  });

  test('LIKE 通配符被转义：输入 _ 不会变成「任意单字符」', async () => {
    const res = await request(app).get('/').query({ name: '_' }).expect(200);

    expect(listBookCodes(res.text)).toHaveLength(0);
  });

  test('查询后翻页仍然带着查询条件（图-2 要避免的正是丢掉条件）', async () => {
    const res = await request(app).get('/').query({ name: '天' }).expect(200);

    // 只有 1 条结果，页码 1 的链接必须仍带 name
    expect(res.text).toContain('name=%E5%A4%A9');
  });

  test('SQL 注入尝试不会破坏查询，也不会拖库', async () => {
    const res = await request(app)
      .get('/')
      .query({ name: "' OR 1=1 -- " })
      .expect(200);

    // 参数化后这只是一个普通字符串，匹配不到任何书名
    expect(listBookCodes(res.text)).toHaveLength(0);
  });
});

describe('功能 3：查看图书详情（图-3）', () => {
  test('详情页 8 个字段全部只读，且没有必填星号', async () => {
    const res = await request(app).get('/books/3').expect(200);

    expect(res.text).toContain('查看图书信息');
    expect((res.text.match(/readonly \/>/g) || [])).toHaveLength(8);
    expect(res.text).not.toContain('required-mark');
    // 详情页没有提交按钮，只有「返回」
    expect(res.text).not.toContain('<button');
  });

  test('详情页展示的是中文借阅状态与格式化日期', async () => {
    const res = await request(app).get('/books/3').expect(200);

    expect(res.text).toContain('value="BK000025"');
    expect(res.text).toContain('value="天龙八部"');
    expect(res.text).toContain('value="金庸"');
    expect(res.text).toContain('value="未借阅"');
    expect(res.text).toContain('value="2014-03-12"');
  });

  test('★ 从带查询条件的列表进详情，返回时查询条件不能丢', async () => {
    const list = await request(app)
      .get('/')
      .query({ name: '天龙八部', page: 1 })
      .expect(200);

    // 列表页的「查看」链接要带上条件
    expect(list.text).toContain('href="/books/3?name=%E5%A4%A9%E9%BE%99%E5%85%AB%E9%83%A8&amp;page=1"');

    const detail = await request(app)
      .get('/books/3')
      .query({ name: '天龙八部', page: 1 })
      .expect(200);

    // 详情页的「返回」链接要把条件原样带回列表
    expect(detail.text).toMatch(
      /class="btn btn-back" href="\/\?name=%E5%A4%A9%E9%BE%99%E5%85%AB%E9%83%A8&amp;page=1"/
    );
  });

  test('不存在的图书 id 返回 404 错误页', async () => {
    const res = await request(app).get('/books/999999').expect(404);

    expect(res.text).toContain('图书不存在');
  });

  test('非数字 id 也返回 404 而不是 500', async () => {
    await request(app).get('/books/abc').expect(404);
    await request(app).get('/books/-1').expect(404);
  });

  test('★ 路由顺序：/books/new 不能被 /books/:id 吞掉', async () => {
    const res = await request(app).get('/books/new').expect(200);

    expect(res.text).toContain('新增图书信息');
  });

  test('未知地址返回 404 且不泄露内部路径堆栈', async () => {
    const res = await request(app).get('/no-such-page').expect(404);

    expect(res.text).toContain('页面不存在');
    expect(res.text).not.toContain('at Object.');
  });
});

describe('提示文案白名单（防 XSS）', () => {
  test.each([
    ['create_ok', '新增成功！'],
    ['update_ok', '修改成功！'],
    ['delete_ok', '删除成功！'],
  ])('msg=%s 在列表页显示「%s」', async (code, text) => {
    const res = await request(app).get('/').query({ msg: code }).expect(200);
    expect(res.text).toContain(text);
  });

  test('白名单之外的 msg 不回显任何内容', async () => {
    const res = await request(app)
      .get('/')
      .query({ msg: '<script>alert(1)</script>' })
      .expect(200);

    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).not.toContain('alert(1)');
  });
});
