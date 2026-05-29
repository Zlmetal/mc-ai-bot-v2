/**
 * sync-keys.js - 从 config.json 同步 API Key 到 MindCraft 的 keys.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, '..', 'data', 'config.json')
const keysPath = path.join(__dirname, '..', 'mindcraft', 'keys.json')

try {
  if (!fs.existsSync(configPath)) {
    console.log('[sync-keys] config.json 不存在，跳过')
    process.exit(0)
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const apiKey = config.llm?.apiKey

  if (!apiKey) {
    console.log('[sync-keys] config.llm.apiKey 为空')
    fs.writeFileSync(keysPath, '{}')
    process.exit(0)
  }

  if (apiKey.includes('...')) {
    console.log('[sync-keys] API Key 是被遮蔽的值，跳过:', apiKey)
    process.exit(0)
  }

  // 写入 keys.json
  const keys = { OPENAI_API_KEY: apiKey }
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2))
  
  // 打印调试信息（隐藏完整 Key）
  const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4)
  console.log(`[sync-keys] ✅ 已同步`)
  console.log(`[sync-keys]   Key: ${masked}`)
  console.log(`[sync-keys]   长度: ${apiKey.length}`)
  console.log(`[sync-keys]   文件: ${keysPath}`)
  
  // 验证写入是否正确
  const verify = JSON.parse(fs.readFileSync(keysPath, 'utf-8'))
  if (verify.OPENAI_API_KEY === apiKey) {
    console.log('[sync-keys]   验证: ✅ 写入正确')
  } else {
    console.log('[sync-keys]   验证: ❌ 写入不一致!')
  }
} catch (err) {
  console.error('[sync-keys] 错误:', err.message)
}
