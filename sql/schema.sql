-- =============================================================================
-- 图书借阅系统（后台管理）— 建表脚本
-- -----------------------------------------------------------------------------
-- 对应原试卷：《2016年10月学士后Java毕业考试机试试卷-2.pdf》第 6 页「数据库设计」
-- 数据库：MySQL 8.0（表达式默认值 DEFAULT (CURRENT_DATE) 需要 8.0.13 及以上）
-- 字符集：utf8mb4（中文字段值必须，否则作者名里的「·」等符号会乱码）
--
-- 导入方式（注意必须指定 utf8mb4，否则中文注释和测试数据会乱码）：
--   mysql -u root -p --default-character-set=utf8mb4 < sql/schema.sql
--   mysql -u root -p --default-character-set=utf8mb4 < sql/data.sql
-- =============================================================================

DROP DATABASE IF EXISTS book_manage;
CREATE DATABASE book_manage DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE book_manage;

-- -----------------------------------------------------------------------------
-- 表 1：book_type 图书类型表
-- 原卷字段：id（主键、自增）、typeName（字符串、非空）
-- 说明：新增/修改页的「图书类型」下拉框数据必须来自本表，不得写死在页面里
-- -----------------------------------------------------------------------------
CREATE TABLE book_type (
  id       INT         NOT NULL AUTO_INCREMENT COMMENT '图书类型ID',
  typeName VARCHAR(50) NOT NULL                COMMENT '图书类型名称',
  PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '图书类型表';

-- -----------------------------------------------------------------------------
-- 表 2：book_info 图书信息表
-- 原卷字段：bookId / bookCode / bookName / bookType / bookAuthor / publishPress
--           publishDate / borrowed / createdBy / creationTime / lastUpdateTime
--
-- 与原卷的 3 处刻意取舍（原卷自身存在矛盾，详见 README「原卷矛盾处理」一节）：
--   1. publishDate 原卷标「非空」，但图-1 列表和图-4 新增页都没有该字段，
--      故保留 NOT NULL 并加 DEFAULT (CURRENT_DATE)，由后端/数据库自动补当天。
--   2. bookAuthor 原卷类型写「整数」，系笔误（作者名不可能为数字），改为 VARCHAR。
--   3. bookAuthor / publishPress 原卷标「非空」，但图-4 里没有必填星号 *，
--      故保留 NOT NULL 并加 DEFAULT ''，后端在用户留空时写入空串兜底。
-- -----------------------------------------------------------------------------
CREATE TABLE book_info (
  bookId         INT          NOT NULL AUTO_INCREMENT COMMENT '图书ID',
  bookCode       VARCHAR(50)  NOT NULL                COMMENT '图书编号',
  bookName       VARCHAR(100) NOT NULL                COMMENT '图书名称',
  bookType       INT          NOT NULL                COMMENT '图书类型，关联 book_type.id',
  bookAuthor     VARCHAR(50)  NOT NULL DEFAULT ''     COMMENT '图书作者（原卷类型误写为整数，实为字符串）',
  publishPress   VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '出版社',
  publishDate    DATE         NOT NULL DEFAULT (CURRENT_DATE) COMMENT '出版日期',
  borrowed       TINYINT      NOT NULL DEFAULT 0      COMMENT '是否借阅：1=已借阅，0=未借阅',
  createdBy      VARCHAR(50)  NOT NULL DEFAULT '系统管理员' COMMENT '入库人（原卷不实现登录，固定为系统管理员）',
  creationTime   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
  lastUpdateTime DATETIME     NULL     DEFAULT NULL   COMMENT '最新更新时间',
  PRIMARY KEY (bookId),
  -- 列表默认按入库时间降序，且支持按图书名称模糊查询，故这两列入索引
  KEY idx_book_info_creation_time (creationTime),
  KEY idx_book_info_book_name (bookName),
  CONSTRAINT fk_book_info_book_type
    FOREIGN KEY (bookType) REFERENCES book_type (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '图书信息表';
