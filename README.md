# 图书借阅系统 - 后台管理（Express + MySQL 重写版）

把《2016 年 10 月学士后 Java 毕业考试机试试卷-2》的「图书借阅系统后台管理」题目，
从原卷的 Struts2 + Spring + Hibernate 技术栈重写为 **Express + MySQL + EJS** 实现。

页面观感逐一对齐原卷图-1 ~ 图-9，六个功能全部落地，并补上了原卷之外的工程化部分
（回归测试、CI、代码规范）。

[![CI](https://github.com/rommelida722-boop/book-backend-manage/actions/workflows/ci.yml/badge.svg)](https://github.com/rommelida722-boop/book-backend-manage/actions/workflows/ci.yml)

---

## 一、环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18（CI 用 20） | 本项目开发时使用 v24 |
| MySQL | ≥ 8.0.13 | `schema.sql` 用到表达式默认值 `DEFAULT (CURRENT_DATE)`，8.0.13 以下不支持 |

字符集必须是 `utf8mb4`，否则作者名里的「·」（如`朱迪斯·克尔`）会乱码。

## 二、安装

```bash
# 1. 装依赖
npm install

# 2. 配置数据库连接
cp .env.example .env
#    然后编辑 .env，把 DB_PASSWORD 换成你本机 MySQL 的 root 密码

# 3. 建表 + 导入测试数据
#    ★ 必须带 --default-character-set=utf8mb4，否则中文会乱码
mysql -u root -p --default-character-set=utf8mb4 < sql/schema.sql
mysql -u root -p --default-character-set=utf8mb4 < sql/data.sql
```

导入完成后 `data.sql` 会自己跑一段自检查询，打印出两个表的行数和前 5 条数据，
方便确认导入成功（`book_type` 8 条、`book_info` 12 条）。

## 三、启动

```bash
npm start     # 生产模式
npm run dev   # 开发模式（nodemon 自动重启）
```

浏览器打开 <http://localhost:3000>。

> `server.js` 启动时会先探活数据库，连不上会直接退出并打印排查步骤，
> 而不是等你点开页面才报 500。

## 四、测试

```bash
npm test        # Jest + supertest，打真库
npm run lint    # ESLint
```

测试**不使用 mock**，会真的连一个 MySQL 8，覆盖六个功能的正常路径与异常路径。
为了让测试不碰你的开发数据，它用的是另一个库：

| 库名 | 用途 |
|---|---|
| `book_manage` | 你平时 `npm start` 用的开发库 |
| `book_manage_test` | `npm test` 专用，**每次自动重建、跑完自动删除** |

`tests/helpers/globalSetup.js` 会读取仓库里的 `sql/schema.sql` 与 `sql/data.sql`，
把里面的库名替换成 `book_manage_test` 后执行。也就是说测试验的结构与数据，
和你照着上面第 2 步装出来的环境**是同一份 SQL**。

当前共 130 个用例，分布如下：

| 文件 | 覆盖内容 | 用例数 |
|---|---|---|
| `tests/pagination.test.js` | 分页滑动窗口算法的边界（不连库） | 20 |
| `tests/book-list.test.js` | 功能 1 / 2 / 3：列表、模糊查询、详情 | 30 |
| `tests/book-create.test.js` | 功能 4：新增，含绕过前端的服务端校验 | 28 |
| `tests/book-update.test.js` | 功能 5：修改，含**入库人/入库时间防篡改回归** | 18 |
| `tests/book-delete.test.js` | 功能 6：删除，含「GET 不能删数据」 | 12 |
| `tests/frontend-validation.test.js` | 前端 jQuery 必填校验、删除确认框（jsdom 跑真实脚本） | 22 |

## 五、六个功能与原卷对照

| # | 功能 | 原卷图 | 实现位置 |
|---|---|---|---|
| 1 | 图书列表（入库时间降序、隔行变色、每页 5 条） | 图-1 | `GET /`　`src/models/bookModel.js#findPage` |
| 2 | 按图书名称模糊查询（输入框记忆查询条件） | 图-2 | `GET /?name=`　`bookModel.js#buildNameFilter` |
| 3 | 查看详情（全字段只读，返回时保留查询条件） | 图-3 | `GET /books/:id` |
| 4 | 新增图书（类型下拉来自 `book_type`、jQuery 校验） | 图-4 / 图-5 | `GET /books/new`、`POST /books` |
| 5 | 修改图书（入库人/入库时间只读） | 图-6 / 图-7 | `GET /books/:id/edit`、`POST /books/:id` |
| 6 | 删除图书（confirm 确认后跳回列表并提示） | 图-8 / 图-9 | `POST /books/:id/delete` |

## 六、目录结构

```
.
├── app.js                      Express 应用装配（不含 listen，便于 supertest 引入）
├── server.js                   入口：先探活数据库再启动
├── jest.config.js / eslint.config.js
├── sql/
│   ├── schema.sql              建表（book_info / book_type）
│   └── data.sql                测试数据（8 个类型 + 12 本图书）
├── src/
│   ├── config/                 env / db 连接池 / 业务常量
│   ├── models/                 DAO 层：只拼 SQL、取数据
│   ├── services/               业务层：校验、默认值、分页计算
│   ├── routes/                 控制器层：解析参数 → 调服务 → 选模板/跳转
│   └── utils/                  分页算法、HTTP 小工具
├── views/                      EJS 模板（list / detail / form / error + partials）
├── public/
│   ├── css/style.css           全部样式
│   ├── js/book-form.js         新增/修改页的必填校验（jQuery 1.8.3）
│   ├── js/book-list.js         删除前的 confirm 确认
│   └── vendor/jquery-1.8.3.min.js
└── tests/                      见上一节
```

分层刻意对齐原卷的「DAO 接口及实现类 / Service 接口及实现类 / 控制器类」三层结构。

## 七、原卷矛盾处理

原试卷的数据库设计说明与界面截图之间存在 4 处冲突。原卷规则是
「**以截图为准**」优先，但对确实无法落地的地方必须做取舍，以下是逐条处理：

### 1. `publishDate` 标为非空，但界面上根本没有这个字段

原卷把 `publishDate` 列为非空，可图-1 的列表、图-4 的新增页里都找不到「出版日期」这一栏。

**处理**：保留 `NOT NULL`，加 `DEFAULT (CURRENT_DATE)`（这也是要求 MySQL ≥ 8.0.13 的原因）。
表单不出现该字段，由服务层在新增时补一个当天日期。这样既满足非空约束，
又不擅自往界面里加原卷没有的输入框。

### 2. `bookAuthor` 的类型写成「整数」

作者名不可能是数字，这是原卷的笔误。

**处理**：改为 `VARCHAR(50)`。若照抄「整数」，图-1 里那些
`（英）Martin Fowler`、`金庸` 全都存不进去。

### 3. `bookAuthor` / `publishPress` 标为非空，但图-4 里这两栏没有必填星号

图-4 上有 `*` 的是：图书编号、图书名称、图书类型、是否借阅、入库人、入库时间，共 6 个；
作者和出版社**没有**星号，即选填。

**处理**：保留 `NOT NULL`，但加 `DEFAULT ''`；用户留空时服务层写入空串而不是 `NULL`。
这样既能保持列非空，又与截图的必填标记一致。

### 4. 「入库人」默认值：文字说 `admin`，截图写「系统管理员」

原卷步骤 12C 的文字描述里入库人写的是 `admin`，但图-4、图-6 的截图里
输入框预填的是「系统管理员」。

**处理**：**以截图为准**，默认值取「系统管理员」，定义在
`src/config/constants.js` 的 `DEFAULT_CREATED_BY`（可用 `.env` 覆盖）。

---

## 八、几个刻意的技术选择

- **服务端渲染（EJS）而不是前后端分离**：原卷的交互模型就是「点保存跳回列表页」，
  SSR 最贴合，也省掉一层接口约定。
- **日期在 SQL 层用 `DATE_FORMAT(..., '%Y-%m-%d')` 格式化**：直接把 `DATETIME`
  交给页面会渲染成 `2014-07-03T00:00:00.000Z`；连接池同时开了 `dateStrings: true`，
  避免驱动做时区转换导致日期差一天。
- **入库时间输入框用 `type="text"` 而不是 `type="date"`**：`type="date"` 的显示格式
  由浏览器语言决定，中文 Chrome 下会显示成 `2014/03/12`，与原卷图-4 的 `2014-03-12` 不符。
  格式正确性由前端 jQuery 与服务端共同校验。
- **删除用 POST 而不是 GET**：GET 语义是「读取」，会被浏览器预取、被爬虫扫到，
  用 GET 删数据意味着打开一个链接就删记录。
- **入库人/入库时间在 SQL 层不可改**：修改页的 `readonly` 只是提示，用户改掉 HTML
  或直接 POST 就能绕过。真正的保证是 `bookModel.update()` 的 `SET` 子句里
  **根本没有这两列**（见 `tests/book-update.test.js` 的防篡改回归）。
- **提示文案走白名单编码而不是直接放 URL**：`/?msg=<script>...</script>` 这种
  把 URL 参数回显到页面的写法等于开了个 XSS 洞；改为只认白名单 key。
- **全部 SQL 用 `?` 占位符**，模糊查询还额外转义了 `%` 和 `_` 通配符。

## 九、开发流程

作业要求的 Git 协作流程：每个模块建 Issue → 拉分支 → 提 PR → 合并后删除分支。

| Issue | 分支 | PR |
|---|---|---|
| #1 后端与数据库 | `feature/backend-crud` | #4 |
| #2 前端页面 | `feature/frontend-views` | #5 |
| #3 测试 + CI + README | `chore/ci-and-tests` | #6 |

CI 在每次推送 `main` 与每个 PR 上自动跑 ESLint + 回归测试。
