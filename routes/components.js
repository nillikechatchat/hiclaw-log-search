/**
 * 组件查询路由
 */

const { getComponents } = require('../services/logReader');

/**
 * 处理组件列表请求
 */
function handleComponents(req, res) {
  const result = getComponents();
  res.end(JSON.stringify(result));
}

module.exports = {
  handleComponents
};