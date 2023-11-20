const initScript = require('../scripts/init');
const chalk = require('chalk');

const { joinPath,getRootPath } = require('../utils/common');
const { createFile, writeJSON } = require('../utils/fileHandle');
const rootPath=getRootPath();
/**
 * @description 爬取所有图标库信息并写入到用户目录下的.iconfontrc文件中
 * @param {String} phoneNumber 账号
 * @param {String} password 密码
 * @param {String} projectIds 需要初始化的图标库id,逗号隔开，没有这默认初始化所有图标库
 */
async function init (phoneNumber, password, projectIds) {
  const projects = await initScript(phoneNumber, password,projectIds);
  const file = joinPath(rootPath, '.iconfontrc');
  await createFile(file);
  await writeJSON(file, { projects });
  console.log(`
  初始化完毕，你可以使用${chalk.green('iconfont-manager ls')}查看你的所有项目.
  请先设置好图标库保存目录(绝对路径)再进行其他操作，设置方法有2种：
  1.执行${chalk.green('iconfont-manager ui')}命令通过图形化界面进行配置;
  2.在${chalk.green(rootPath)}目录下找到${chalk.green('.iconfontrc')}文件直接编辑FilePath属性。`);
}

module.exports = (...args) => {
  return init(...args).catch(err => {
    throw err
  })
}
