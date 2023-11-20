const { chalkGreen, spinnerStart, spinnerSucceed } = require('../utils/common');
const { projectLibraryUrl } = require('../utils/iconfont.config');
const { createBrowser, login, getFontClass, pageGo, getProjectInfo } = require('../utils/operation');

const initScript = async (user, password,projectIds) => {
  const browser = await createBrowser();
  chalkGreen('✔ 打开Browser');
  const page = await browser.pages().then(e => e[0]);
  chalkGreen('✔ 打开Page');
  await login(page, user, password);

  // 登录成功后，打开项目库页面
  await pageGo(page, projectLibraryUrl)

  spinnerStart('开始获取图标库基本信息');
  // 获取所有的图标库信息
  let projects = await getProjectInfo(page, user, password);
  spinnerSucceed('成功获取图标库基本信息');

  spinnerStart('开始获取图标库在线链接');

  console.log('projectIds---',projectIds);
  const projectIdsArr=projectIds ? projectIds.split(','):[];
  const projectsInfo=projectIdsArr.length ? projects.filter(item=>projectIdsArr.includes(item.id)):projects;
  for (let i = 0; i < projectsInfo.length; i++) {
    projectsInfo[i].fontClass = await getFontClass(page, projectsInfo[i].id)
  }
  spinnerSucceed('成功获取图标库在线链接');

  await page.close();
  chalkGreen('✔ 关闭Page');
  await browser.close();
  chalkGreen('✔ 关闭Browser');

  return projectsInfo
}

module.exports = initScript
