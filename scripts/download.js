const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const compressing = require('compressing');

 // 超时时间，登录页面url，登录请求url，项目管理url
const { timeout, loginUrl, loginRequestUrl, projectLibraryUrl } = require('../utils/iconfont.config');

// 信息打印 && 主动抛错 && 路径获取与拼接
const { chalkGreen, spinnerStart, spinnerSucceed, throwError, resolvePath, joinPath } = require('../utils/common');

let browser = null,       // Puppeteer的Browser对象
    page = null,          // Puppeteer的Page对象
    isFirstEnter = true,  // 是否首次进入
    isNeedLogin = true;   // 是否需要登录

/**
 * @description 输入一个图标库的信息，使用puppeteer模拟登录，下载图标并解压到相应目录
 * @param {String}  id 项目id
 * @param {String}  name 项目名称
 * @param {String}  user 账号（暂时只支持手机号）
 * @param {String}  password 密码
 * @param {String}  filePath 文件保存地址
 * @param {Boolean} isRelogin 是否重新登录（多个用户时，不关闭Browser，重新登录即可）
 * @param {Boolean} isCloseBrowser 是否关闭Browser和Page
 */
const downloadScript = async (id, name, user, password, filePath, isRelogin, isCloseBrowser) => {
  // 只有首次进入才需要新开Browser和Page
  // 避免出错，只允许打开一个Browser，压缩包也不大，再者不会同时更新几十个项目，没必要打开多个Browser
  if (isFirstEnter) {
    // 打开Browser和Page
    browser = await puppeteer.launch({
      headless: true,
      timeout,
      defaultViewport: { // 默认视窗较小，宽高建议设置一下，防止页面需要滚动或者样式乱
        width: 1366,
        height: 768
      },
    });
    chalkGreen('✔ 打开Browser');
    page = await browser.newPage();
    chalkGreen('✔ 打开Page');
    isFirstEnter = false;
  }
  // 多个图标库更新时，如果是不同的用户才需要重新登录
  if (isNeedLogin) {
    // 跳转到登录页面，输入账号密码，点击登录按钮
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#userid');
    await page.waitForSelector('#password');
    spinnerStart('开始登录');
    // 先清空表单，再重新输入账号密码（切换用户登录时输入框可能有缓存）
    await page.$eval('#userid', (input, user) => { input.value = user }, user);
    await page.$eval('#password', (input, password) => { input.value = password }, password);
    // 登录请求结束后1秒，如果页面已经跳转，登录成功，代码照常执行，否则判断为登录失败
    page.on('response', async(r) => {
      if(r.url().includes(loginRequestUrl)) {
        await page.waitForTimeout(1000);
        !page.isClosed() && await page.$('.mx-btn-submit') && throwError('登录失败，账号或密码错误');
      }
    })
    await page.click('.mx-btn-submit');
    await page.$('#userid-error') && throwError('账号不合法');
    await page.$('#password-error') && throwError('密码不合法');
    await page.waitForNavigation();
    spinnerSucceed('登录成功');
    isNeedLogin = false;
  }

  // 登录成功后，打开项目链接
  spinnerStart('跳转到图标库管理页');
  await page.goto(`${projectLibraryUrl}&projectId=${id}`, {
    waitUntil: 'domcontentloaded'
  })
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
  fs.existsSync(zipPath) && await fs.remove(zipPath);
  fs.existsSync(zipPath + '.crdownload') && await fs.remove(zipPath + '.crdownload');
  // 处理使用指引的按钮的干扰，点击所有可视的“我知道了”按钮（可能有多个）
  await page.$$eval('.btn-iknow', btns => btns.map(btn => btn.clientWidth > 0 && btn.click()));
  // 点击下载按钮，触发压缩包下载（一个这么特殊的按钮一个特殊的id或class都没有，第一个a标签：下载至本地）
  await page.click('.project-manage-bar > a.bar-text');
  spinnerStart('开始下载图标');
  const start = Date.now();
  while (!fs.existsSync(zipPath)) {
    // 每隔一秒看一下download.zip文件是否下载完毕，超时时间设为30秒
    await page.waitForTimeout(1000);
    if (Date.now() - start >= timeout) {
      throw new Error('下载超时');
    }
  }
  spinnerSucceed('图标下载完成');
  // 同时更新多个图标库（且是不同用户时），在不关闭Browser和Page的情况下重新登录
  if (isRelogin) {
    spinnerStart('开始退出登录');
    // 鼠标滑过右上角用户头像，点击退出按钮退出登录
    await page.hover('.quick-menu > ul > li:last-child');
    await page.click('.quick-menu .head-dropdown:last-child li:last-child');
    // await page.waitForNavigation();
    await page.waitForNetworkIdle();
    spinnerSucceed('退出登录成功');
    isNeedLogin = true;
  }
  // 当所有的图标库更新完毕时，关闭Browser和Page
  if (isCloseBrowser) {
    await page.close();
    chalkGreen('✔ 关闭Page');
    await browser.close();
    chalkGreen('✔ 关闭Browser');
    // 关闭浏览器，初始化所有默认配置，保证同一个入口再次进来运行正常
    page = null;
    browser = null;
    isFirstEnter = true;
    isNeedLogin = true;
  }
  // 解压 => 删除 => 重命名，具体操作步骤如下：
  // 1.下载成功后的文件名为download.zip
  // 2.将download.zip解压后会变成前缀为font_的文件夹
  // 3.将原有的iconfont文件夹删除
  // 4.将前缀为font_的文件夹重命名为iconfont文件夹
  await compressingZip(savePath);
  await deleteDir(savePath);
  await renameDir(savePath);
  chalkGreen(`✔ 图标库:${name} 更新完成🎉🎉🎉`);
}

// 解压downloa.zip
async function compressingZip(savePath) {
  await compressing.zip.uncompress(joinPath(savePath, 'download.zip'), savePath)
}

// 删除原有iconfont文件夹和下载的download.zip
async function deleteDir(savePath) {
  let iconfontFolder = joinPath(savePath, 'iconfont');
  let zipFile = joinPath(savePath, 'download.zip');
  fs.existsSync(iconfontFolder) && await fs.remove(iconfontFolder);
  fs.existsSync(zipFile) && await fs.remove(zipFile);
}

// 将download.zip解压后前缀为font_的文件夹重命名为iconfont
async function renameDir(savePath) {
  const dirs = fs.readdirSync(savePath);
  for (let dir of dirs) {
    if (dir.startsWith('font_')) {
      await fs.rename(joinPath(savePath, dir), joinPath(savePath, 'iconfont'));
      break;
    }
  }
}

module.exports = downloadScript
