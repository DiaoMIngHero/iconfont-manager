const { readConfig,writeConfig } = require('../utils/fileHandle');
const downloadScript = require('../scripts/download');
const { findData, isArray } = require('../utils/common');

/**
 * @description 更新一个或多个图标库（下载图标文件到本地，并且更新配置文件）
 * @param {String | String[]} projectIds 一个或多个图标库id
 */
async function update(projectIds) {
  const { projects } = await readConfig();
  let data = findData(projects, 'id', projectIds);
  // 多个不同的user先排序，处理完一个user的全部项目再处理下一个
  let queue = isArray(data) ? data.sort((a, b) => a.user - b.user) : [data]
  // fontClass
  let fontClassQueue = {};
  while(queue.length) {
    const current = queue.shift();
    const isCloseBrowser = queue.length === 0;
    const isRelogin = queue.length > 0 && queue[0].user !== current.user;
    const result = await downloadScript({...current}, isRelogin, isCloseBrowser);
    fontClassQueue[current.id] = result.fontClass;
  }
  // 更新fontClass
  for (let i = 0; i < projects.length; i++) {
    if (fontClassQueue[projects[i].id]) {
      projects[i].fontClass = fontClassQueue[projects[i].id];
    }
  }
  await writeConfig({ projects });
  
}

module.exports = (...args) => {
  return update(...args).catch(err => {
    throw err
  })
}
