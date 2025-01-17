const { transformPath } = require('../utils/common');
// 超时时间，项目管理url
const { timeout, projectLibraryUrl } = require('../utils/iconfont.config');
// 信息打印 && 主动抛错 && 路径获取与拼接
const { chalkGreen, spinnerStart, spinnerSucceed, resolvePath, joinPath } = require('../utils/common');
// 是否存在 && 解压 && 删除 && 重命名
const { isExist, removeFile, compressingZip, getUnzipDirPath, getFontFiles,moveFile,deleteRepeatFile } = require('../utils/fileHandle');
// 创建Browser && 登录 && 退出 && 处理操作引导
const { createBrowser, login, logout, handleIknowBtn, pageGo } = require('../utils/operation');
const { getFontClass } = require('../utils/operation');
let browser = null,       // Puppeteer的Browser对象
    page = null,          // Puppeteer的Page对象
    isFirstEnter = true,  // 是否首次进入
    isNeedLogin = true;   // 是否需要登录

/**
 * @description 下载图标库
 * @param {Object} options 图标库信息
 * @param {String} options.id 图标库id
 * @param {String} options.name 图标库名称
 * @param {String} options.user 用户名
 * @param {String} options.password 密码
 * @param {String} options.filePath 下载路径
 * @param {String} options.includes 需要下载的文件
 * @param {String} options.excludes 排除下载的文件
 * @param {String} options.filePath 下载路径
 * @param {Boolean} isRelogin 是否需要重新登录
 * @param {Boolean} isCloseBrowser 是否需要关闭Browser
 */
const downloadScript = async (options, isRelogin, isCloseBrowser) => {
  let { id, name, user, password, filePath,includes,excludes } = options;
  filePath=transformPath(filePath);
  // 只有首次进入才需要新开Browser和Page
  // 避免出错，只打开一个Browser，压缩包也不大，再者不会同时更新几十个项目，没必要打开多个Browser
  // 若是大数据，可以考虑创建Puppeteer连接池，管理Browser和page的数量及对应关系
  if (isFirstEnter) {
    // 打开Browser和Page
    browser = await createBrowser();
    chalkGreen('✔ 打开Browser');
    page = await browser.pages().then(e => e[0]);
    chalkGreen('✔ 打开Page');
    isFirstEnter = false;
  }
  // 多个图标库更新时，如果是不同的用户才需要重新登录
  if (isNeedLogin) {
    await login(page, user, password);
    isNeedLogin = false;
  }

  // 登录成功后，打开项目链接
  spinnerStart('跳转到图标库管理页');
  await pageGo(page, `${projectLibraryUrl}&projectId=${id}`)
  await page.waitForSelector('.project-manage-bar > a.bar-text');
  spinnerSucceed('图标库管理页跳转成功');

  // 通过CDP会话设置下载路径，理论上也支持相对路径，已经拼好了绝对路径，当然建议使用绝对路径
  let savePath = resolvePath(filePath);
  await page._client.send('Page.setDownloadBehavior', {
    behavior: 'allow', //允许下载请求
    downloadPath: savePath  //设置下载路径
  });

  // 仅做测试使用：限制上传下载速度，可以更好地查看下载效果和测试超时等
  // await page._client.send('Network.emulateNetworkConditions', {
  //   offline: false,
  //   latency: 200, // ms
  //   downloadThroughput: 10 * 1024,
  //   uploadThroughput: 20 * 1024
  // });

  // 下载超时或某些情况,文件夹下可能有download.zip和download.zip.crdownload（仍有可能下载成功或存在缓存文件），需要先删除再下载
  const zipPath = joinPath(savePath, 'download.zip');
  await removeFile(zipPath);
  await removeFile(zipPath + '.crdownload');
  // await page.waitForSelector('.bar-link');
  // 处理使用指引的按钮的干扰，点击所有可视的“我知道了”按钮（可能有多个）
  await handleIknowBtn(page)
  // 点击下载按钮，触发压缩包下载（一个这么特殊的按钮一个特殊的id或class都没有，第一个a标签：下载至本地）
  await page.click('.project-manage-bar .btn-group > a.bar-text');
  spinnerStart('开始下载图标');
  const start = Date.now();
  while (!isExist(zipPath)) {
    // 每隔0.3秒看一下download.zip文件是否下载完毕，超时时间设为30秒
    await page.waitForTimeout(300);
    if (Date.now() - start >= timeout) {
      throw new Error('下载超时');
    }
  }
  spinnerSucceed('图标下载完成');
  const fontClass=await getFontClass(page, id);
  // 同时更新多个图标库（且是不同用户时），在不关闭Browser和Page的情况下重新登录
  if (isRelogin) {
    await logout(page);
    isNeedLogin = true;
  }
  // 当所有的图标库更新完毕时，关闭Browser和Page
  if (isCloseBrowser) {
    await page.close();
    chalkGreen('✔ 关闭Page');
    await browser.close();
    chalkGreen('✔ 关闭Browser');
    // 关闭浏览器，初始化所有默认配置，保证同一个入口再次进来运行正常
    // [page, browser, isFirstEnter, isNeedLogin] = [null, null, true, true]
    page = null;
    browser = null;
    isFirstEnter = true;
    isNeedLogin = true;
  }
  // 解压 => 删除，具体操作步骤如下：
  // 1.下载成功后的文件名为download.zip
  // 2.将download.zip解压后会变成前缀为font_的文件夹
  // 4.将目标文件夹中的同名文件删除
  // 5.将font_文件夹中的文件移动到目标文件夹中
  // 6.删除download.zip和font_文件夹
  await compressingZip(savePath);
  const fontDir = getUnzipDirPath(savePath);
  const fontFiles = getFontFiles(fontDir,includes,excludes);
  await deleteRepeatFile(savePath, fontFiles);
  for(let file of fontFiles) {
    await moveFile(fontDir, file, savePath);
  }
  await removeFile(zipPath);
  await removeFile(fontDir);

  chalkGreen(`✔ 图标库:${name} 更新完成🎉🎉🎉`);
  return {fontClass}
}

module.exports = downloadScript
