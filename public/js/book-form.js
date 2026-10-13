/**
 * 新增 / 修改页的必填项前端校验（原卷要求「用 jQuery 做验证」）。
 *
 * 使用 jQuery 1.8.3，故按该版本的写法组织（$.trim、$.each、.on）。
 *
 * 校验规则严格对齐原卷图-4 的 6 个必填星号，与服务端
 * src/services/bookService.js 的 validateBookForm 保持一致。
 *
 * 注意：前端校验只是体验优化，用户禁用 JS 或直接 POST 都能绕过，
 * 所以服务端必须独立再校验一遍（见 bookService.validateBookForm）。
 */
(function ($) {
  'use strict';

  /** 入库时间用 text 输入框（为了稳定显示 2014-03-12 而非 2014/03/12），
   *  因此格式正确性得自己校验，不能再依赖浏览器的原生日期控件。 */
  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  var FIELDS = [
    { id: 'bookCode', label: '图书编号', required: true },
    { id: 'bookName', label: '图书名称', required: true },
    { id: 'bookType', label: '图书类型', required: true },
    { id: 'borrowed', label: '是否借阅', required: true },
    { id: 'createdBy', label: '入库人', required: true },
    {
      id: 'creationTime',
      label: '入库时间',
      required: true,
      pattern: DATE_PATTERN,
      patternMessage: '入库时间格式不正确，应为 年-月-日，例如 2014-03-12'
    }
  ];

  /**
   * 校验单个字段，返回错误文案；通过则返回空串。
   * @param {object} field 规则定义
   * @param {string} value 已 trim 的输入值
   * @returns {string}
   */
  function validateField(field, value) {
    if (field.required && value === '') {
      return field.label + '不能为空';
    }
    if (value !== '' && field.pattern && !field.pattern.test(value)) {
      return field.patternMessage;
    }
    // 形如 2014-13-45 的日期能过正则，但不是真实日期
    if (value !== '' && field.pattern && isNaN(new Date(value + 'T00:00:00').getTime())) {
      return field.label + '不是一个有效日期';
    }
    return '';
  }

  $(function () {
    var $form = $('#book-form');
    if ($form.length === 0) {
      return;
    }

    $form.on('submit', function (event) {
      var messages = [];
      var $firstInvalid = null;

      $.each(FIELDS, function (index, field) {
        var $input = $('#' + field.id);
        if ($input.length === 0) {
          return;
        }

        var message = validateField(field, $.trim($input.val() || ''));
        var $wrapper = $input.closest('.field');

        if (message) {
          messages.push(message);
          $wrapper.addClass('has-error');
          if (!$firstInvalid) {
            $firstInvalid = $input;
          }
        } else {
          $wrapper.removeClass('has-error');
        }
      });

      if (messages.length > 0) {
        // 拦住提交，弹窗提示全部问题，并把焦点放到第一个不合格的输入框
        event.preventDefault();
        window.alert(messages.join('\n'));
        if ($firstInvalid) {
          $firstInvalid.focus();
        }
      }
    });

    // 用户开始补填/改错时即时清除该项的红框，不必等到再次提交
    $form.on('input change', '.field-input', function () {
      var $input = $(this);
      var rule = null;

      $.each(FIELDS, function (index, field) {
        if (field.id === $input.attr('id')) {
          rule = field;
          return false;
        }
      });

      if (rule && validateField(rule, $.trim($input.val() || '')) === '') {
        $input.closest('.field').removeClass('has-error');
      }
    });
  });
})(jQuery);
