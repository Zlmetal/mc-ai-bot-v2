// generate-textures.js - 从 Minecraft 客户端 JAR 提取纹理并生成 atlas
const path = require('path')
const fs = require('fs')
const https = require('https')
const { execSync } = require('child_process')

const version = process.argv[2] || '1.21.11'
const viewerDir = path.resolve(__dirname, 'node_modules/prismarine-viewer')
const mcDir = path.resolve(__dirname, '.mc-cache')

// 加载 prismarine-viewer 的 atlas 生成器
const { makeTextureAtlas } = require(path.resolve(viewerDir, 'viewer/lib/atlas'))
const { prepareBlocksStates } = require(path.resolve(viewerDir, 'viewer/lib/modelsBuilder'))

const texturesPath = path.resolve(viewerDir, 'public/textures')
const blockStatesPath = path.resolve(viewerDir, 'public/blocksStates')

fs.mkdirSync(texturesPath, { recursive: true })
fs.mkdirSync(blockStatesPath, { recursive: true })
fs.mkdirSync(mcDir, { recursive: true })

// 下载文件
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      file.close()
      fs.unlinkSync(dest)
      reject(err)
    })
  })
}

// 从 JAR 中提取文件
function extractFromJar(jarPath, pattern, destDir) {
  try {
    execSync(`unzip -o -q "${jarPath}" "${pattern}" -d "${destDir}"`, { stdio: 'ignore' })
    return true
  } catch (e) {
    return false
  }
}

async function main() {
  console.log(`[纹理生成] 开始为 ${version} 生成纹理...`)
  
  // 1. 下载版本清单
  const manifestPath = path.join(mcDir, 'version_manifest_v2.json')
  if (!fs.existsSync(manifestPath)) {
    console.log('[纹理生成] 下载版本清单...')
    await download('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', manifestPath)
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const versionInfo = manifest.versions.find(v => v.id === version)
  
  if (!versionInfo) {
    console.error(`[纹理生成] 找不到版本 ${version}`)
    process.exit(1)
  }
  
  // 2. 下载版本 JSON
  const versionJsonPath = path.join(mcDir, `${version}.json`)
  if (!fs.existsSync(versionJsonPath)) {
    console.log(`[纹理生成] 下载 ${version} 版本信息...`)
    await download(versionInfo.url, versionJsonPath)
  }
  
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))
  
  // 3. 下载客户端 JAR
  const clientJarPath = path.join(mcDir, `${version}-client.jar`)
  if (!fs.existsSync(clientJarPath)) {
    const clientUrl = versionJson.downloads.client.url
    console.log(`[纹理生成] 下载客户端 JAR (${(versionJson.downloads.client.size / 1024 / 1024).toFixed(1)}MB)...`)
    await download(clientUrl, clientJarPath)
    console.log('[纹理生成] 客户端 JAR 下载完成')
  }
  
  // 4. 提取纹理和模型
  const extractDir = path.join(mcDir, `${version}-assets`)
  fs.mkdirSync(extractDir, { recursive: true })
  
  console.log('[纹理生成] 提取方块纹理...')
  extractFromJar(clientJarPath, 'assets/minecraft/textures/block/*', extractDir)
  
  console.log('[纹理生成] 提取方块模型...')
  extractFromJar(clientJarPath, 'assets/minecraft/models/block/*', extractDir)
  
  console.log('[纹理生成] 提取方块状态...')
  extractFromJar(clientJarPath, 'assets/minecraft/blockstates/*', extractDir)
  
  // 5. 构造 minecraft-assets 格式的数据
  const texturesDir = path.join(extractDir, 'assets/minecraft/textures/block')
  const modelsDir = path.join(extractDir, 'assets/minecraft/models/block')
  const blockstatesDir = path.join(extractDir, 'assets/minecraft/blockstates')
  
  // 读取纹理文件列表
  const textureFiles = {}
  if (fs.existsSync(texturesDir)) {
    const files = fs.readdirSync(texturesDir).filter(f => f.endsWith('.png'))
    for (const file of files) {
      const name = file.replace('.png', '')
      textureFiles[name] = path.join(texturesDir, file)
    }
  }
  console.log(`[纹理生成] 找到 ${Object.keys(textureFiles).length} 个纹理文件`)
  
  // 读取方块模型
  const blockModels = {}
  if (fs.existsSync(modelsDir)) {
    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const model = JSON.parse(fs.readFileSync(path.join(modelsDir, file), 'utf-8'))
        blockModels[file.replace('.json', '')] = model
      } catch (e) { /* 忽略解析错误 */ }
    }
  }
  console.log(`[纹理生成] 找到 ${Object.keys(blockModels).length} 个方块模型`)
  
  // 6. 使用 minecraft-data 获取方块信息
  const mcData = require('minecraft-data')(version)
  const blocks = mcData.blocks
  
  // 7. 构造 atlas 需要的数据格式
  // minecraft-assets 格式：{ blockModels, textureContent }
  const textureContent = {}
  for (const [name, filePath] of Object.entries(textureFiles)) {
    try {
      textureContent['minecraft:block/' + name] = fs.readFileSync(filePath)
    } catch (e) { /* 忽略读取错误 */ }
  }
  
  // 构造 assets 对象
  const assets = {
    blockModels: blockModels,
    textureContent: textureContent,
    blocks: blocks
  }
  
  // 8. 生成 atlas
  console.log('[纹理生成] 生成纹理 atlas...')
  try {
    const atlas = makeTextureAtlas(assets)
    
    // 保存 blockStates JSON
    const blocksStates = JSON.stringify(prepareBlocksStates(assets, atlas))
    fs.writeFileSync(path.resolve(blockStatesPath, version + '.json'), blocksStates)
    console.log(`[纹理生成] 生成 blocksStates/${version}.json`)
    
    // 保存纹理 PNG
    const out = fs.createWriteStream(path.resolve(texturesPath, version + '.png'))
    const stream = atlas.canvas.pngStream()
    
    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => out.write(chunk))
      stream.on('end', () => {
        console.log(`[纹理生成] 生成 textures/${version}.png`)
        console.log('[纹理生成] 完成!')
        resolve()
      })
      stream.on('error', (err) => {
        console.error('[纹理生成] PNG 生成错误:', err.message)
        reject(err)
      })
    })
  } catch (err) {
    console.error('[纹理生成] Atlas 生成失败:', err.message)
    // 回退到 minecraft-assets
    console.log('[纹理生成] 尝试使用 minecraft-assets 回退...')
    try {
      const mcAssets = require('minecraft-assets')(version)
      const atlas = makeTextureAtlas(mcAssets)
      const blocksStates = JSON.stringify(prepareBlocksStates(mcAssets, atlas))
      fs.writeFileSync(path.resolve(blockStatesPath, version + '.json'), blocksStates)
      const out = fs.createWriteStream(path.resolve(texturesPath, version + '.png'))
      const stream = atlas.canvas.pngStream()
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => out.write(chunk))
        stream.on('end', () => { console.log('[纹理生成] 回退完成'); resolve() })
        stream.on('error', reject)
      })
    } catch (e) {
      console.error('[纹理生成] 回退也失败:', e.message)
      process.exit(1)
    }
  }
}

main().catch(err => {
  console.error('[纹理生成] 致命错误:', err)
  process.exit(1)
})
