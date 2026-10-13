'use strict';

/**
 * 全局业务常量。
 * 抽出来是为了让「系统管理员」「每页 5 条」这类原卷写死的值只有一处定义，
 * 页面、服务、测试都引用同一份，改的时候不会漏。
 */

require('./env');

module.exports = {
  /**
   * 入库人默认值。
   * 依据原卷图-4 / 图-6 截图：输入框里预填「系统管理员」。
   * （原卷 PDF 步骤 12C 的文字写的是 admin，与截图冲突，本项目以截图为准。）
   */
  DEFAULT_CREATED_BY: process.env.DEFAULT_CREATED_BY || '系统管理员',

  /** 每页显示条数，原卷要求每页 5 条 */
  PAGE_SIZE: Number(process.env.PAGE_SIZE) || 5,

  /** 是否借阅的取值与中文文案，对应原卷「1、已借阅 0、未借阅」 */
  BORROWED: {
    NOT_BORROWED: 0,
    BORROWED: 1,
  },
  BORROWED_TEXT: {
    0: '未借阅',
    1: '已借阅',
  },

  /** 服务端口 */
  PORT: Number(process.env.PORT) || 3000,

  /**
   * 操作结果提示文案（对齐原卷图-5 / 图-7 / 图-9 的弹窗原文）。
   *
   * 用「编码」而不是直接把文案放 URL，原因有二：
   *   1. 安全——`/?msg=<script>...</script>` 这种直接回显到页面的写法等于开了个 XSS 洞；
   *      走编码后页面只认白名单里的 key，未知 key 一律忽略。
   *   2. URL 干净，中文不必做百分号编码。
   */
  FLASH_MESSAGES: {
    create_ok: '新增成功！',
    create_fail: '新增失败！',
    update_ok: '修改成功！',
    update_fail: '修改失败！',
    delete_ok: '删除成功！',
    delete_fail: '删除失败！',
  },
};
