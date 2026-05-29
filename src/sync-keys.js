/**
 * sync-keys.js - 从 config.json 同步 API Key 到 MindCraft 的 keys.json
 * 用法: node sync-keys.js
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

  if (!apiKey || apiKey.includes('...')) {
    console.log('[sync-keys] 未找到有效的 API Key')
    fs.writeFileSync(keysPath, '{}')
    process.exit(0)
  }

  const keys = { OPENAI_API_KEY: apiKey }
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2))
  console.log(`[sync-keys] ✅ 已同步 (Key: ${apiKey.substring(0, 8)}...)`)
} catch (err) {
  console.error('[sync-keys] 错误:', err.message)
}
