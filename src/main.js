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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ========== 配置 ==========

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json')

const DEFAULT_CONFIG = {
  mindcraft: {
    host: 'localhost',
    port: 8080
  },
  web: {
    port: 3000
  },
  mc: {
    host: '',
    port: 25565,
    version: 'auto'
  },
  llm: {
    provider: 'mimo',
    model: 'MiMo-V2.5',
    apiKey: '',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1'
  },
  tts: {
    enabled: true,
    model: 'MiMo-V2.5-TTS-VoiceDesign',
    voice: '温柔的年轻男性，声音清晰，语速适中'
  },
  bot: {
    name: '小智',
    personality: '勤劳、好奇、有点话多、喜欢探索',
    style: '说话简洁但有温度，偶尔开玩笑，用中文'
  }
}

function loadConfig() {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
    return DEFAULT_CONFIG
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const config = loadConfig()

// 从环境变量读取 MC 服务器配置
if (process.env.MC_HOST) config.mc.host = process.env.MC_HOST
if (process.env.MC_PORT) config.mc.port = parseInt(process.env.MC_PORT)
if (process.env.MC_AUTH) config.mc.auth = process.env.MC_AUTH
if (process.env.MINDCRAFT_HOST) config.mindcraft.host = process.env.MINDCRAFT_HOST
if (process.env.MINDCRAFT_PORT) config.mindcraft.port = parseInt(process.env.MINDCRAFT_PORT)

// 写入 MindCraft 配置
const mindcraftSettingsPath = path.join(__dirname, '..', 'mindcraft', 'settings.js')
if (fs.existsSync(mindcraftSettingsPath)) {
  try {
    let settingsContent = fs.readFileSync(mindcraftSettingsPath, 'utf-8')
    settingsContent = settingsContent.replace(/"host":\s*"[^"]*"/, `"host": "${config.mc.host || 'host.docker.internal'}"`)
    settingsContent = settingsContent.replace(/"port":\s*\d+/, `"port": ${config.mc.port || 25565}`)
    settingsContent = settingsContent.replace(/"auth":\s*"[^"]*"/, `"auth": "${config.mc.auth || 'offline'}"`)
    fs.writeFileSync(mindcraftSettingsPath, settingsContent, 'utf-8')
    console.log('[MindCraft] 配置已更新')
  } catch (e) {
    console.error('[MindCraft] 配置更新失败:', e.message)
  }
}

// ========== 初始化模块 ==========

const memory = new MemorySystem()
const tts = new TTSService(config)

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
    
    // 注册为监听者
    mindcraftSocket.emit('listen-to-agents')
  })

  mindcraftSocket.on('disconnect', () => {
    console.log('[MindCraft] 连接断开')
    connectedToMindCraft = false
  })

  // 监听 agent 状态更新
  mindcraftSocket.on('agents-status', (agents) => {
    for (const agent of agents) {
      agentStates[agent.name] = agent
    }
    // 广播给所有 WebSocket 客户端
    broadcastToClients({ type: 'agents-status', data: agents })
  })

  // 监听 bot 输出
  mindcraftSocket.on('bot-output', (agentName, message) => {
    console.log(`[Bot] ${agentName}: ${message}`)
    
    // 存入记忆
    memory.addToHistory(agentName, 'assistant', message)
    
    // 广播给所有 WebSocket 客户端
    broadcastToClients({ type: 'bot-message', agent: agentName, text: message })
  })
}

// ========== Web 服务 ==========

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// 中间件
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

// API: 获取配置
app.get('/api/config', (req, res) => {
  const safeConfig = JSON.parse(JSON.stringify(config))
  if (safeConfig.llm?.apiKey) {
    safeConfig.llm.apiKey = safeConfig.llm.apiKey.substring(0, 8) + '...'
  }
  if (safeConfig.tts?.apiKey) {
    safeConfig.tts.apiKey = safeConfig.tts.apiKey.substring(0, 8) + '...'
  }
  safeConfig._configured = !!(config.llm?.apiKey)
  safeConfig._mindcraft_connected = connectedToMindCraft
  res.json(safeConfig)
})

// API: 保存配置
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
    if (newConfig.tts) {
      if (newConfig.tts.apiKey && !newConfig.tts.apiKey.includes('...')) {
        Object.assign(config.tts, newConfig.tts)
      } else {
        const { apiKey, ...rest } = newConfig.tts
        Object.assign(config.tts, rest)
      }
    }
    if (newConfig.bot) Object.assign(config.bot, newConfig.bot)

    saveConfig(config)
    tts.updateConfig(config)
    
    // 同步 API Key 到 MindCraft 的 keys.json
    try {
      const apiKey = config.llm?.apiKey
      if (apiKey) {
        const keysPath = path.join(__dirname, '..', 'mindcraft', 'keys.json')
        fs.writeFileSync(keysPath, JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2))
        console.log('[配置] keys.json 已同步')
      }
    } catch (e) {
      console.error('[配置] keys.json 同步失败:', e.message)
    }
    
    res.json({ success: true, message: '配置已保存' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// API: 获取模型列表
app.post('/api/fetch-models', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body
    if (!baseUrl) return res.json({ success: false, message: '请填写 API 地址' })

    // 尝试常见的模型列表端点
    const endpoints = ['/models', '/v1/models']
    let models = []

    for (const endpoint of endpoints) {
      try {
        const url = baseUrl.replace(/\/$/, '') + endpoint
        const headers = { 'Content-Type': 'application/json' }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

        const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
        if (!response.ok) continue

        const data = await response.json()
        
        // 解析不同格式的响应
        if (data.data && Array.isArray(data.data)) {
          // OpenAI 格式: { data: [{ id: "model-name" }] }
          models = data.data.map(m => ({ id: m.id || m.name || m }))
        } else if (Array.isArray(data)) {
          // 直接数组格式
          models = data.map(m => ({ id: typeof m === 'string' ? m : m.id || m.name }))
        }

        if (models.length > 0) break
      } catch (e) {
        continue
      }
    }

    if (models.length > 0) {
      res.json({ success: true, models })
    } else {
      res.json({ success: false, message: '未获取到模型列表，请手动输入模型名' })
    }
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// API: 测试 LLM 连接
app.post('/api/test-llm', async (req, res) => {
  try {
    const testConfig = req.body
    if (!testConfig.llm?.apiKey) {
      return res.json({ success: false, message: '请先填写 API Key' })
    }

    const baseUrl = testConfig.llm.baseUrl || config.llm.baseUrl
    const apiKey = testConfig.llm.apiKey.includes('...') ? config.llm.apiKey : testConfig.llm.apiKey
    const model = testConfig.llm.model || config.llm.model

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: '你好，测试连接' }],
        max_tokens: 50
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.json({ success: false, message: `API 错误 (${response.status}): ${err}` })
    }

    const data = await response.json()
    res.json({ success: true, reply: data.choices[0].message.content })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// API: 测试 TTS 语音合成（Edge-TTS）
app.post('/api/test-tts', async (req, res) => {
  try {
    const testConfig = req.body
    const voice = testConfig.tts?.voice || config.tts?.voice || '云希（男）'

    // 更新 TTS 配置
    tts.updateConfig({ ...config, tts: { ...config.tts, voice: testConfig.tts?.voice || config.tts?.voice } })

    const audioUrl = await tts.synthesize('你好，这是语音合成测试。我是你的AI游戏伙伴。')
    if (audioUrl) {
      res.json({ success: true, audioUrl })
    } else {
      res.json({ success: false, message: '语音合成失败，请检查 edge-tts 是否安装' })
    }
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// API: 获取记忆统计
app.get('/api/memory', (req, res) => {
  res.json({
    identity: memory.getAllIdentity(),
    relationships: memory.getAllRelationships(),
    locations: memory.getAllLocations()
  })
})

// API: 向 bot 发送消息
app.post('/api/chat', async (req, res) => {
  try {
    const { text, agent } = req.body
    
    if (!connectedToMindCraft) {
      return res.json({ success: false, message: '未连接到 MindCraft' })
    }

    // 存入记忆
    memory.addToHistory('web-user', 'user', text)

    // 通过 Socket.IO 发送给 MindCraft
    mindcraftSocket.emit('send-message', agent || config.bot.name, {
      message: text,
      from: 'web-user'
    })

    res.json({ success: true })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// API: TTS 合成
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body
    if (!config.tts?.enabled) {
      return res.json({ success: false, message: 'TTS 未启用' })
    }
    
    const audioUrl = await tts.synthesizeToFile(text)
    if (audioUrl) {
      res.json({ success: true, audioUrl })
    } else {
      res.json({ success: false, message: 'TTS 合成失败' })
    }
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

// 音频文件
app.use('/voices', express.static(path.join(__dirname, '..', 'data', 'voices')))

// ========== WebSocket ==========

const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('[Web] 新客户端连接')

  // 发送当前状态
  ws.send(JSON.stringify({
    type: 'status',
    data: {
      mindcraft_connected: connectedToMindCraft,
      agents: Object.values(agentStates)
    }
  }))

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())
      
      if (msg.type === 'chat') {
        // 转发给 MindCraft
        if (connectedToMindCraft) {
          memory.addToHistory('web-user', 'user', msg.text)
          mindcraftSocket.emit('send-message', msg.agent || config.bot.name, {
            message: msg.text,
            from: 'web-user'
          })
        }
      }
    } catch (err) {
      console.error('[Web] 消息处理错误:', err.message)
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
  })
})

function broadcastToClients(data) {
  const msg = JSON.stringify(data)
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}

// 定期推送状态
setInterval(() => {
  broadcastToClients({
    type: 'status',
    data: {
      mindcraft_connected: connectedToMindCraft,
      agents: Object.values(agentStates)
    }
  })
}, 3000)

// ========== 启动 ==========

const PORT = config.web?.port || 3000

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================')
  console.log('  🎮 MC AI Bot V2')
  console.log('  基于 MindCraft + Web界面 + 记忆 + 语音')
  console.log('========================================')
  console.log(`[Web] ✅ 服务启动: http://0.0.0.0:${PORT}`)
  console.log(`[Web] 📱 手机访问: http://你的IP:${PORT}`)
  console.log('========================================')
})

// 连接 MindCraft
connectToMindCraft()

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[系统] 正在关闭...')
  memory.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n[系统] 正在关闭...')
  memory.close()
  process.exit(0)
})
