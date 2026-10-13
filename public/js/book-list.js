/**
 * 列表页的删除确认（原卷图-8）。
 *
 * 文案「确定删除该条图书信息？」逐字对齐原卷图-8 的弹窗截图。
 *
 * 为什么用 confirm() 而不是自定义弹窗：
 *   原卷图-8、图-9、图-5、图-7 都是浏览器原生弹窗（标题栏「来自网页的消息」），
 *   用原生 confirm / alert 还原度最高，且无需额外 DOM 与样式。
 *
 * 取消时同时 preventDefault 并返回 false：
 *   preventDefault 拦下浏览器默认提交行为，return false 作为 jQuery 事件处理
 *   的兜底写法（jQuery 1.8.3 里返回 false 等价于同时 stopPropagation 与
 *   preventDefault），双保险避免误删。
 */
(function ($) {
  'use strict';

  $(function () {
    $('.js-delete').on('click', function (event) {
      if (!window.confirm('确定删除该条图书信息？')) {
        event.preventDefault();
        return false;
      }
      return true;
    });
  });
})(jQuery);
