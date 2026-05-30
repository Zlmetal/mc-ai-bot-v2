/**
 * main.js - MC AI Bot V2 入口
 * 基于 MindCraft + Web界面 + 记忆系统 + 语音交互
 */

import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { io } from 'socket.io-client'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import MemorySystem from './memory.js'
import TTSService from './tts.js'
import STTService from './stt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ========== 配置 ==========

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json')

const DEFAULT_CONFIG = {
  mindcraft: { host: 'localhost', port: 8080 },
  web: { port: 3000 },
  mc: { host: '', port: 25565, version: '1.21.11' },
  llm: { provider: 'mimo', model: 'mimo-v2.5', apiKey: '', baseUrl: 'https://api.xiaomimimo.com/v1' },
  tts: { enabled: true, voice: '云希（男）' },
  bot: { name: 'andrew', personality: '勤劳、好奇、有点话多、喜欢探索', style: '说话简洁但有温度，偶尔开玩笑，用中文' }
}

function loadConfig() {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const config = loadConfig()

// 从环境变量覆盖
if (process.env.MC_HOST) config.mc.host = process.env.MC_HOST
if (process.env.MC_PORT) config.mc.port = parseInt(process.env.MC_PORT)
if (process.env.MINDCRAFT_HOST) config.mindcraft.host = process.env.MINDCRAFT_HOST
if (process.env.MINDCRAFT_PORT) config.mindcraft.port = parseInt(process.env.MINDCRAFT_PORT)

// 生成 MindCraft 配置和 profile
function syncMindCraftConfig() {
  const mcDir = path.join(__dirname, '..', 'mindcraft')
  if (!fs.existsSync(mcDir)) return

  // 生成 andrew.json（用设置页面的名字和人设）
  const botName = config.bot?.name || 'andrew'
  const botStyle = config.bot?.style || '说话简洁但有温度，偶尔开玩笑，用中文'
  
  // 校验 LLM 模型名（防止 TTS 模型名污染）
  let llmModel = config.llm?.model || 'mimo-v2.5'
  if (llmModel.includes('tts') || llmModel.includes('TTS') || llmModel.includes('embedding')) {
    console.warn(`[配置] LLM 模型名异常: ${llmModel}，回退到 mimo-v2.5`)
    llmModel = 'mimo-v2.5'
    config.llm.model = llmModel
    saveConfig(config)
  }
  
  // 校验 Bot 名字（不能是模型名）
  if (botName === 'mimo' || botName === 'MiMo' || botName.includes('model')) {
    console.warn(`[配置] Bot 名字异常: ${botName}，回退到 andrew`)
    config.bot.name = 'andrew'
    saveConfig(config)
  }
  
  const profile = {
    name: botName,
    model: {
      api: 'openai',
      model: llmModel,
      url: (config.llm?.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '')
    }
  }
  fs.writeFileSync(path.join(mcDir, 'profiles', `${botName}.json`), JSON.stringify(profile, null, 2))

  // 更新 settings.js 里的 profiles
  const settingsPath = path.join(mcDir, 'settings.js')
  if (fs.existsSync(settingsPath)) {
    let content = fs.readFileSync(settingsPath, 'utf-8')
    content = content.replace(/"profiles":\s*\[[^\]]*\]/, `"profiles": ["./profiles/${botName}.json"]`)
    // 更新人设 prompt
    content = content.replace(/"init_message":\s*"[^"]*"/, `"init_message": "大家好！我是${botName}。我的性格是${config.bot?.personality || ''}。${botStyle}"`)
    fs.writeFileSync(settingsPath, content)
  }

  // 同步 API Key
  const apiKey = config.llm?.apiKey
  if (apiKey && !apiKey.includes('...')) {
    fs.writeFileSync(path.join(mcDir, 'keys.json'), JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2))
    console.log('[配置] keys.json 已同步')
  }

  console.log(`[配置] Bot 名字: ${botName}`)
}

syncMindCraftConfig()

// ========== 初始化模块 ==========

const memory = new MemorySystem()
const tts = new TTSService(config)
let stt = null
try { stt = new STTService() } catch (e) { console.log('[STT] 跳过初始化:', e.message) }

// ========== MindCraft Socket.IO 连接 ==========

let mindcraftSocket = null
let connectedToMindCraft = false
const agentStates = {}

function connectToMindCraft() {
  const url = `http://${config.mindcraft.host}:${config.mindcraft.port}`
  console.log(`[MindCraft] 正在连接 ${url}...`)

  mindcraftSocket = io(url, {
    reconnection: true,
    reconnectionDelay: 2000
  })

  mindcraftSocket.on('connect', () => {
    console.log('[MindCraft] ✅ 已连接')
    connectedToMindCraft = true
    mindcraftSocket.emit('listen-to-agents')
  })

  mindcraftSocket.on('disconnect', () => {
    console.log('[MindCraft] 连接断开')
    connectedToMindCraft = false
  })

  mindcraftSocket.on('agents-status', (agents) => {
    for (const agent of agents) agentStates[agent.name] = agent
    broadcastToClients({ type: 'agents-status', data: agents })
  })

  mindcraftSocket.on('bot-output', (agentName, message) => {
    console.log(`[Bot] ${agentName}: ${message}`)
    memory.addToHistory(agentName, 'assistant', message)
    broadcastToClients({ type: 'bot-message', agent: agentName, text: message })
  })
}

// ========== Web 服务 ==========

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// 中间件
app.use(express.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use('/voices', express.static(path.join(__dirname, '..', 'data', 'voices')))

// ========== API 路由 ==========

app.get('/api/status', (req, res) => {
  res.json({
    connected: connectedToMindCraft,
    agents: Object.values(agentStates)
  })
})

app.get('/api/config', (req, res) => {
  const safe = JSON.parse(JSON.stringify(config))
  if (safe.llm?.apiKey) safe.llm.apiKey = safe.llm.apiKey.substring(0, 8) + '...'
  if (safe.tts?.apiKey) safe.tts.apiKey = safe.tts.apiKey.substring(0, 8) + '...'
  safe._configured = !!(config.llm?.apiKey)
  safe._mindcraft_connected = connectedToMindCraft
  res.json(safe)
})

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body
    if (newConfig.mindcraft) Object.assign(config.mindcraft, newConfig.mindcraft)
    if (newConfig.mc) Object.assign(config.mc, newConfig.mc)
    if (newConfig.llm) {
      if (newConfig.llm.apiKey && !newConfig.llm.apiKey.includes('...')) {
        Object.assign(config.llm, newConfig.llm)
      } else {
        const { apiKey, ...rest } = newConfig.llm
        Object.assign(config.llm, rest)
      }
    }
    if (newConfig.tts) Object.assign(config.tts, newConfig.tts)
    if (newConfig.bot) Object.assign(config.bot, newConfig.bot)

    saveConfig(config)
    tts.updateConfig(config)
    syncMindCraftConfig()

    // 重启 MindCraft Agent
    if (connectedToMindCraft && mindcraftSocket) {
      // 获取当前 agent 名字（可能是旧名字）
      const currentAgentName = Object.keys(agentStates)[0] || config.bot?.name || 'andrew'
      mindcraftSocket.emit('restart-agent', currentAgentName)
      console.log('[配置] 已请求重启 MindCraft Agent:', currentAgentName)
    }

    res.json({ success: true, message: '配置已保存' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.post('/api/fetch-models', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body
    if (!baseUrl) return res.json({ success: false, message: '请填写 API 地址' })
    const endpoints = ['/models', '/v1/models']
    let models = []
    for (const endpoint of endpoints) {
      try {
        const url = baseUrl.replace(/\/+$/, '') + endpoint
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
        if (!response.ok) continue
        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map(m => ({ id: m.id || m.name || m }))
        } else if (Array.isArray(data)) {
          models = data.map(m => ({ id: typeof m === 'string' ? m : m.id || m.name }))
        }
        if (models.length > 0) break
      } catch (e) { continue }
    }
    res.json(models.length > 0 ? { success: true, models } : { success: false, message: '未获取到模型列表' })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

app.post('/api/test-llm', async (req, res) => {
  try {
    const testConfig = req.body
    const baseUrl = (testConfig.llm?.baseUrl || config.llm?.baseUrl || '').replace(/\/+$/, '')
    const apiKey = (testConfig.llm?.apiKey && !testConfig.llm.apiKey.includes('...')) ? testConfig.llm.apiKey : config.llm?.apiKey
    const model = testConfig.llm?.model || config.llm?.model
    if (!apiKey) return res.json({ success: false, message: '请先填写 API Key' })
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '你好' }], max_tokens: 50 })
    })
    if (!response.ok) { const err = await response.text(); return res.json({ success: false, message: `API 错误 (${response.status}): ${err}` }) }
    const data = await response.json()
    res.json({ success: true, reply: data.choices[0].message.content })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

app.post('/api/test-tts', async (req, res) => {
  try {
    const voice = req.body.tts?.voice || config.tts?.voice || '云希（男）'
    tts.updateConfig({ ...config, tts: { ...config.tts, voice } })
    const audioUrl = await tts.synthesize('你好，这是语音合成测试。')
    res.json(audioUrl ? { success: true, audioUrl } : { success: false, message: '合成失败' })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

// STT 语音转文字
app.post('/api/stt', express.raw({ type: 'audio/*', limit: '10mb' }), async (req, res) => {
  try {
    if (!stt || !stt.ready) return res.json({ success: false, message: 'STT 未就绪' })
    const text = await stt.transcribe(req.body)
    res.json({ success: true, text: text || '' })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body
    if (!config.tts?.enabled) return res.json({ success: false, message: 'TTS 未启用' })
    const audioUrl = await tts.synthesizeToFile(text)
    res.json(audioUrl ? { success: true, audioUrl } : { success: false, message: '合成失败' })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

// ========== WebSocket ==========

const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('[Web] 新客户端连接')

  ws.send(JSON.stringify({
    type: 'status',
    data: { mindcraft_connected: connectedToMindCraft, agents: Object.values(agentStates) }
  }))

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'chat' && msg.text) {
        // 转发给 MindCraft
        const botName = config.bot?.name || 'andrew'
        if (connectedToMindCraft && mindcraftSocket) {
          memory.addToHistory('web-user', 'user', msg.text)
          mindcraftSocket.emit('send-message', botName, {
            message: msg.text,
            from: 'WEB'
          })
        } else {
          ws.send(JSON.stringify({ type: 'text', text: '未连接到 MindCraft，请等待...' }))
        }
      }
    } catch (err) {
      console.error('[Web] 消息处理错误:', err.message)
    }
  })

  ws.on('close', () => clients.delete(ws))
})

function broadcastToClients(data) {
  const msg = JSON.stringify(data)
  for (const c of clients) {
    if (c.readyState === 1) c.send(msg)
  }
}

// 定期推送状态
setInterval(() => {
  broadcastToClients({
    type: 'status',
    data: { mindcraft_connected: connectedToMindCraft, agents: Object.values(agentStates) }
  })
}, 3000)

// ========== 启动 ==========

const PORT = config.web?.port || 3000

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================')
  console.log('  🎮 MC AI Bot V2')
  console.log('========================================')
  console.log(`[Web] ✅ 服务启动: http://0.0.0.0:${PORT}`)
  console.log('[Web] 📱 手机访问: http://你的IP:' + PORT)
  console.log('========================================')
})

connectToMindCraft()

process.on('SIGINT', () => { memory.close(); process.exit(0) })
process.on('SIGTERM', () => { memory.close(); process.exit(0) })
