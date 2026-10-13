'use strict';

/**
 * 功能 4 的**前端**那一半：新增 / 修改页的 jQuery 必填校验（原卷要求「用 jQuery 做验证」）。
 *
 * 前面的接口测试全部绕过了前端（直接 POST 给 Express），
 * 所以 public/js/book-form.js 这段代码一行都没被覆盖到。
 * 这里用 jsdom 搭一个真实 DOM，把仓库里那份 jQuery 1.8.3 和书写的脚本原样加载进去，
 * 验证的是**真正会跑在浏览器里的那份文件**，而不是重写一遍逻辑。
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const JQUERY_SRC = fs.readFileSync(
  path.join(ROOT, 'public', 'vendor', 'jquery-1.8.3.min.js'),
  'utf8'
);
const FORM_SRC = fs.readFileSync(
  path.join(ROOT, 'public', 'js', 'book-form.js'),
  'utf8'
);

/** 与 views/form.ejs 的结构保持一致：每个字段外面套一层 .field */
const FIELD_HTML = [
  ['bookCode', 'text'],
  ['bookName', 'text'],
  ['bookAuthor', 'text'],
  ['publishPress', 'text'],
  ['createdBy', 'text'],
  ['creationTime', 'text'],
];

/**
 * 搭一个装了 jQuery + 校验脚本的表单页面。
 * @param {object} values 各字段的初始值
 * @returns {Promise<{dom: JSDOM, alerts: string[]}>}
 */
async function buildForm(values = {}) {
  const inputs = FIELD_HTML.map(([id, type]) => {
    const value = values[id] === undefined ? '' : values[id];
    return `<div class="field">
      <input class="field-input" type="${type}" id="${id}" name="${id}" value="${value}" />
    </div>`;
  }).join('\n');

  // 图书类型与是否借阅是 select，单独构造（value 放在 option 上）
  const selects = `
    <div class="field">
      <select class="field-input" id="bookType" name="bookType">
        <option value="">——请选择——</option>
        <option value="1"${values.bookType === '1' ? ' selected' : ''}>小说</option>
      </select>
    </div>
    <div class="field">
      <select class="field-input" id="borrowed" name="borrowed">
        <option value="0"${values.borrowed === '0' ? ' selected' : ''}>未借阅</option>
        <option value="1"${values.borrowed === '1' ? ' selected' : ''}>已借阅</option>
      </select>
    </div>`;

  const dom = new JSDOM(
    `<!DOCTYPE html><html lang="zh-CN"><body>
      <form id="book-form" class="book-form" method="post" action="/books">
        <div class="form-grid">${inputs}${selects}</div>
      </form>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true }
  );

  const alerts = [];
  dom.window.alert = (message) => alerts.push(message);

  // 原样加载仓库里的 jQuery 与校验脚本
  dom.window.eval(JQUERY_SRC);
  dom.window.eval(FORM_SRC);

  // book-form.js 用 $(function(){...}) 绑定，jQuery 1.8.3 的 ready 走 setTimeout(...,1)
  await new Promise((resolve) => setTimeout(resolve, 30));

  return { dom, alerts };
}

/**
 * 触发一次真实的 submit 事件，返回该事件对象。
 * 用原生 dispatchEvent 而不是 jQuery 的 trigger，
 * 这样能直接读 defaultPrevented，确凿地证明「提交被拦住了」。
 * @param {JSDOM} dom
 * @returns {Event}
 */
function submit(dom) {
  const form = dom.window.document.getElementById('book-form');
  const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

/** 当前被标红的字段 id 列表 */
function errorFields(dom) {
  const nodes = dom.window.document.querySelectorAll('.field.has-error');
  return Array.from(nodes).map((node) => node.querySelector('input, select').id);
}

const VALID_VALUES = {
  bookCode: 'BK000099',
  bookName: '测试书',
  bookType: '1',
  borrowed: '0',
  createdBy: '系统管理员',
  creationTime: '2014-03-12',
};

describe('前端 jQuery 校验（功能 4，图-4 的 6 个必填项）', () => {
  test('依赖就位：jQuery 1.8.3 成功挂到 window 上', async () => {
    const { dom } = await buildForm(VALID_VALUES);

    expect(dom.window.jQuery).toBeDefined();
    expect(dom.window.jQuery.fn.jquery).toBe('1.8.3');
  });

  test('全部填对时不拦截提交，也不弹窗', async () => {
    const { dom, alerts } = await buildForm(VALID_VALUES);

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(false);
    expect(alerts).toHaveLength(0);
    expect(errorFields(dom)).toHaveLength(0);
  });

  test('★ 必填项全空 -> 拦住提交，并按表单顺序报出全部错误', async () => {
    const { dom, alerts } = await buildForm({});

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(true);
    expect(alerts).toHaveLength(1);

    const messages = alerts[0].split('\n');
    // 「是否借阅」不在这里：它是下拉框且默认选中「未借阅」，永远不为空
    // （服务端仍会对 0/1 之外的取值兜底，见 book-create.test.js）
    expect(messages).toEqual([
      '图书编号不能为空',
      '图书名称不能为空',
      '图书类型不能为空',
      '入库人不能为空',
      '入库时间不能为空',
    ]);
  });

  test('★ 出错的字段全部被标红', async () => {
    const { dom } = await buildForm({});

    submit(dom);

    expect(errorFields(dom).sort()).toEqual(
      ['bookCode', 'bookName', 'bookType', 'createdBy', 'creationTime'].sort()
    );
  });

  test('作者与出版社是选填，留空不报错（图-4 这两栏没有星号）', async () => {
    const { dom, alerts } = await buildForm({ ...VALID_VALUES, bookAuthor: '', publishPress: '' });

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(false);
    expect(alerts).toHaveLength(0);
  });

  test('填空格等同于空（$.trim 生效）', async () => {
    const { dom, alerts } = await buildForm({ ...VALID_VALUES, bookName: '   ' });

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(true);
    expect(alerts[0]).toContain('图书名称不能为空');
  });

  test.each([
    ['2014/03/12', '入库时间格式不正确，应为 年-月-日，例如 2014-03-12'],
    ['20140312', '入库时间格式不正确，应为 年-月-日，例如 2014-03-12'],
    ['2014-13-45', '入库时间不是一个有效日期'],
    // ★ 下面这三个能通过正则、new Date() 也不会返回 NaN（JS 会自动进位），
    //   必须靠「格式化回去比对」才能识别出来。曾经它们会被放过去，
    //   最后在 MySQL 严格模式下写库失败变成 500。
    ['2014-02-30', '入库时间不是一个有效日期'],
    ['2014-04-31', '入库时间不是一个有效日期'],
    ['2015-02-29', '入库时间不是一个有效日期'],
  ])('入库时间 %p -> 被拦下并提示', async (value, expected) => {
    const { dom, alerts } = await buildForm({ ...VALID_VALUES, creationTime: value });

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(true);
    expect(alerts[0]).toContain(expected);
    expect(errorFields(dom)).toEqual(['creationTime']);
  });

  test.each(['2016-02-29', '2014-03-12', '2024-12-31'])(
    '真实存在的日期 %p 应当放行（含闰日）',
    async (value) => {
      const { dom, alerts } = await buildForm({ ...VALID_VALUES, creationTime: value });

      const event = submit(dom);

      expect(event.defaultPrevented).toBe(false);
      expect(alerts).toHaveLength(0);
    }
  );

  test('未选图书类型（仍是「——请选择——」）会被拦下', async () => {
    const { dom, alerts } = await buildForm({ ...VALID_VALUES, bookType: '' });

    const event = submit(dom);

    expect(event.defaultPrevented).toBe(true);
    expect(alerts[0]).toContain('图书类型不能为空');
    expect(errorFields(dom)).toEqual(['bookType']);
  });

  test('只有出错的那一项被标红，其它保持干净', async () => {
    const { dom } = await buildForm({ ...VALID_VALUES, bookCode: '' });

    submit(dom);

    expect(errorFields(dom)).toEqual(['bookCode']);
  });

  test('改对之后即时消掉红框，不必等到再次提交', async () => {
    const { dom } = await buildForm({ ...VALID_VALUES, bookCode: '' });
    submit(dom);
    expect(errorFields(dom)).toEqual(['bookCode']);

    // 模拟用户补填：改 value 再触发 input 事件
    const input = dom.window.document.getElementById('bookCode');
    input.value = 'BK000099';
    dom.window.jQuery(input).trigger('input');

    expect(errorFields(dom)).toHaveLength(0);
  });

  test('页面里没有 #book-form 时脚本安静退出，不抛错', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><p>没有表单</p></body></html>', {
      runScripts: 'outside-only',
    });
    dom.window.eval(JQUERY_SRC);
    expect(() => dom.window.eval(FORM_SRC)).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 30));
  });
});

describe('删除确认框（功能 6，图-8）', () => {
  const LIST_SRC = fs.readFileSync(path.join(ROOT, 'public', 'js', 'book-list.js'), 'utf8');

  async function buildList() {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <form class="inline-form" method="post" action="/books/3/delete">
          <button type="submit" class="op-link op-delete js-delete">删除</button>
        </form>
      </body></html>`,
      { runScripts: 'outside-only' }
    );

    const dialogs = [];
    dom.window.confirm = (message) => {
      dialogs.push(message);
      return dom.window.__confirmResult;
    };

    dom.window.eval(JQUERY_SRC);
    dom.window.eval(LIST_SRC);
    await new Promise((resolve) => setTimeout(resolve, 30));

    return { dom, dialogs };
  }

  /**
   * 触发一次真实的 click 事件。
   * 对 <button type="submit"> 来说，阻止 click 的默认行为就等于阻止表单提交，
   * 所以直接读 click 事件的 defaultPrevented 即可判定这次删除有没有被放行。
   */
  function clickDelete(dom) {
    const button = dom.window.document.querySelector('.js-delete');
    const event = new dom.window.Event('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    return event;
  }

  test('点击删除时弹出确认框，文案与原卷图-8 一致', async () => {
    const { dom, dialogs } = await buildList();
    dom.window.__confirmResult = false;

    clickDelete(dom);

    expect(dialogs).toEqual(['确定删除该条图书信息？']);
  });

  test('★ 用户点「取消」时不放行，表单不会被提交', async () => {
    const { dom } = await buildList();
    dom.window.__confirmResult = false;

    const event = clickDelete(dom);

    expect(event.defaultPrevented).toBe(true);
  });

  test('用户点「确定」时放行，提交照常进行', async () => {
    const { dom } = await buildList();
    dom.window.__confirmResult = true;

    const event = clickDelete(dom);

    expect(event.defaultPrevented).toBe(false);
  });
});
