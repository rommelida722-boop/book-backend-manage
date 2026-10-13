'use strict';

/**
 * HTTP 层的小工具：异步路由包装 + 查询条件透传。
 */

/**
 * 包装 async 路由函数，把 reject 转交给 Express 的错误处理中间件。
 *
 * Express 4 不会自动捕获 async 函数里抛出的异常——不包这一层的话，
 * 数据库报错会变成「请求一直挂着直到超时」，而不是返回 500 页面。
 *
 * @param {Function} handler async (req, res, next) => {}
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * 构造「返回列表页时保留查询条件」的 URL 后缀。
 *
 * 原卷图-2 明确要求：从详情 / 修改页点「返回」回到列表时，
 * 必须保留查询条件和查询结果。所以把 name 与 page 一路带在链接上。
 *
 * @param {import('express').Request} req
 * @returns {string} 形如 `?name=天龙八部&page=2`；无查询条件时返回空串
 */
function buildBackSuffix(req) {
  const params = new URLSearchParams();

  const { name, page } = req.query || {};
  if (name) {
    params.set('name', String(name));
  }
  if (page) {
    params.set('page', String(page));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * 从白名单里取提示文案。非法编码一律忽略，避免任意文本被塞进页面。
 * 白名单由 constants.FLASH_MESSAGES 提供。
 *
 * @param {object} messages 白名单映射
 * @param {*} code URL 上的 msg 参数
 * @returns {string} 提示文案，无匹配则返回空串
 */
function resolveFlash(messages, code) {
  if (!code) {
    return '';
  }
  return Object.prototype.hasOwnProperty.call(messages, code)
    ? messages[code]
    : '';
}

module.exports = { asyncHandler, buildBackSuffix, resolveFlash };
