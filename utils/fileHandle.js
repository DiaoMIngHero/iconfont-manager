const fs = require('fs-extra');
const compressing = require('compressing');

const { joinPath,getRootPath } = require('./common');

const rootPath=getRootPath();

const iconfontrcPath=joinPath(rootPath, '.iconfontrc');

// 通用（同步函数）：是否存在
const isExist = path => fs.existsSync(path)

// 通用：创建文件或文件夹，需先判断是否存在
const createFile = async (file) => !isExist(file) && await fs.createFile(file)

// 通用：删除文件或文件夹，需先判断是否存在
const removeFile = async (file) => isExist(file) && await fs.remove(file)

// 通用：将json数据写入文件
const writeJSON = async (file, jsonData) => await fs.writeJSON(file, jsonData)

// 通用：读取json文件
const readJSON = async (jsonFile) => await fs.readJSON(jsonFile)

// 错误提示
const errorTip = `.iconfontrc不存在，请使用iconfont-manager init <phoneNumber> <password>进行初始化或在${rootPath}目录下新建该文件`

// 解析用户目录下的.iconfontrc文件，获取所有的图标库信息
const readConfig = async () => {
  let config = []
  if(!isExist(iconfontrcPath)) {
    console.error(errorTip);
  } else {
    try {
      config = await readJSON(iconfontrcPath);
    } catch(err) {
      console.error(err);
    }
  }
  return config
}

// 将新的图标库信息写入用户目录下的.iconfontrc文件
const writeConfig = async (content) => {
  if(!isExist(joinPath(rootPath, '.iconfontrc'))) {
    console.error(errorTip);
  } else {
    try {
      await writeJSON(iconfontrcPath, content);
    } catch(err) {
      console.error(err)
    }
  }
}

// 解压downloa.zip
const compressingZip = async(path) => {
  await compressing.zip.uncompress(joinPath(path, 'download.zip'), path)
}

// 删除目标文件夹中的同名文件
async function deleteRepeatFile(path,fileNames) {
  const dirs = fs.readdirSync(path);
  for (let dir of dirs) {
    const stats = fs.statSync(joinPath(path, dir));
    if(stats.isFile() && fileNames.includes(dir)) {
      await removeFile(joinPath(path, dir));
    }
  }
}

// 移动目标文件到指定文件夹
async function moveFile(basePath,fileName,targetPath) {
  await fs.move(joinPath(basePath, fileName), joinPath(targetPath, fileName));
}

// 获取解压缩之后的文件夹路径
function getUnzipDirPath(path) {
  const dirs = fs.readdirSync(path);
  let unzipDirPath = '';
  for (let dir of dirs) {
    if (dir.startsWith('font_')) {
      unzipDirPath = joinPath(path, dir);
      break;
    }
  }
  return unzipDirPath;
}

// 获取download.zip解压后前缀为font_的文件夹的所有文件
function getFontFiles(fontDirPath) {
  // 获取font_文件夹下的所有文件
  const fontDir = fs.readdirSync(fontDirPath);
  const fontFiles = [];
  fontDir.forEach(file => {
    if(file.startsWith('demo')){
      return;
    }
    const filePath = joinPath(fontDirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      // 如果是文件，将其路径添加到数组中
      fontFiles.push(file);
    }
  });

  return fontFiles;
}

module.exports = {
  isExist,
  createFile,
  removeFile,
  writeJSON,
  readJSON,
  readConfig,
  writeConfig,
  compressingZip,
  getFontFiles,
  getUnzipDirPath,
  deleteRepeatFile,
  moveFile
}
