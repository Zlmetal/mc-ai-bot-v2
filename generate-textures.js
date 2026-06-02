// generate-textures.js - 为指定版本生成纹理 atlas
const path = require('path')
const fs = require('fs')

const version = process.argv[2] || '1.21.11'
const viewerDir = path.resolve(__dirname, 'node_modules/prismarine-viewer')

// 加载 prismarine-viewer 的 atlas 和 modelsBuilder
const { makeTextureAtlas } = require(path.resolve(viewerDir, 'viewer/lib/atlas'))
const { prepareBlocksStates } = require(path.resolve(viewerDir, 'viewer/lib/modelsBuilder'))
const mcAssets = require('minecraft-assets')

const texturesPath = path.resolve(viewerDir, 'public/textures')
const blockStatesPath = path.resolve(viewerDir, 'public/blocksStates')

fs.mkdirSync(texturesPath, { recursive: true })
fs.mkdirSync(blockStatesPath, { recursive: true })

console.log(`Generating textures for ${version}...`)

const assets = mcAssets(version)
const atlas = makeTextureAtlas(assets)

// 保存 blockStates JSON（先生成，不依赖 PNG）
const blocksStates = JSON.stringify(prepareBlocksStates(assets, atlas))
fs.writeFileSync(path.resolve(blockStatesPath, version + '.json'), blocksStates)
console.log(`Generated blocksStates/${version}.json`)

// 保存纹理 PNG
const out = fs.createWriteStream(path.resolve(texturesPath, version + '.png'))
const stream = atlas.canvas.pngStream()
stream.on('data', (chunk) => out.write(chunk))
stream.on('end', () => {
  console.log(`Generated textures/${version}.png`)
  console.log('Done!')
})

stream.on('error', (err) => {
  console.error('Error generating texture:', err.message)
  process.exit(1)
})
