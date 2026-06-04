/**
 * main.js - MC AI Bot V2 入口
 * 基于 MindCraft + Web界面 + 记忆系统 + 语音交互
 * 支持多 Bot 管理
 */

import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { io } from 'socket.io-client'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import MemorySystem from './memory.js'
import TTSService from './tts.js'
import STTService from './stt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ========== 配置 ==========

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json')

const DEFAULT_CONFIG = {
  bots: [{
    id: 'bot_1',
    name: 'andrew',
    enabled: true,
    personality: '勤劳、好奇、有点话多、喜欢探索',
    style: '说话简洁但有温度，偶尔开玩笑，用中文',
    model: { api: 'openai', model: 'mimo-v2.5', url: 'https://api.xiaomimimo.com/v1' },
    vision_model: { api: 'openai', model: 'mimo-v2.5', url: 'https://api.xiaomimimo.com/v1' },
    apiKey: ''
  }],
  mc: { host: '', port: 25565, version: '1.21.11', auth: 'offline' },
  mindcraft: { host: 'localhost', port: 8080 },
  web: { port: 3000, username: 'admin', password: 'password' },
  tts: { enabled: true, voice: '云希（男）' },
  wake: { enabled: false, word: '' }
}

function generateId() {
  return 'bot_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
}

function loadConfig() {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))

  // 向后兼容：旧格式 config.bot → config.bots[0]
  if (config.bot && !config.bots) {
    console.log('[配置] 迁移旧格式 config.bot → config.bots')
    config.bots = [{
      id: generateId(),
      name: config.bot.name || 'andrew',
      enabled: true,
      personality: config.bot.personality || '',
      style: config.bot.style || '',
      model: config.llm ? { api: 'openai', model: config.llm.model || 'mimo-v2.5', url: (config.llm.baseUrl || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '') } : DEFAULT_CONFIG.bots[0].model,
      vision_model: DEFAULT_CONFIG.bots[0].vision_model,
      apiKey: config.llm?.apiKey || ''
    }]
    delete config.bot
    saveConfig(config)
    console.log('[配置] 迁移完成')
  }

  // 确保 bots 数组存在
  if (!config.bots || !Array.isArray(config.bots) || config.bots.length === 0) {
    config.bots = DEFAULT_CONFIG.bots
  }

  // 确保每个 bot 有 id
  config.bots.forEach(bot => {
    if (!bot.id) bot.id = generateId()
  })

  return config
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

const config = loadConfig()

// 安全解析 JS 对象（替代 new Function）
function safeParseJSObject(str) {
  // 去掉 BOM、行注释、块注释
  let cleaned = str.replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//gs, '')
  // 找到第一个 { 和最后一个 }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let json = cleaned.substring(start, end + 1)
  // 去掉尾逗号
  json = json.replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(json)
  } catch (e) {
    console.warn('[配置] JSON 解析失败:', e.message)
    return null
  }
}

// 从环境变量覆盖
if (process.env.MC_HOST) config.mc.host = process.env.MC_HOST
if (process.env.MC_PORT) config.mc.port = parseInt(process.env.MC_PORT)
if (process.env.MINDCRAFT_HOST) config.mindcraft.host = process.env.MINDCRAFT_HOST
if (process.env.MINDCRAFT_PORT) config.mindcraft.port = parseInt(process.env.MINDCRAFT_PORT)

// ========== syncMindCraftConfig ==========

function syncMindCraftConfig() {
  const mcDir = path.join(__dirname, '..', 'mindcraft')
  if (!fs.existsSync(mcDir)) return

  const profilesDir = path.join(mcDir, 'profiles')
  if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true })

  const enabledBots = config.bots.filter(b => b.enabled !== false)
  const profileNames = []

  for (const bot of enabledBots) {
    const botName = bot.name || 'andrew'
    const personality = bot.personality || '勤劳、好奇'
    const style = bot.style || '说话简洁'

    // 使用 bot 自己的 model 配置，或回退到全局
    const botModel = bot.model || { api: 'openai', model: 'mimo-v2.5', url: 'https://api.xiaomimimo.com/v1' }
    const botVisionModel = bot.vision_model || botModel

    // 获取 per-bot 设置
    const botLanguage = bot.language || 'zh-CN'
    const botMaxMessages = bot.maxMessages || 15
    const botNumExamples = bot.numExamples || 2
    const botAllowVision = bot.allowVision ? 'true' : 'false'
    const botLoadMemory = bot.loadMemory !== false ? 'true' : 'false'
    const botSpeak = bot.speak ? 'true' : 'false'
    const botInitMessage = bot.initMessage || ''

    // conversing 内容（性格+风格+记忆）
    const conversingText = `你是 ${botName}，性格特征：${personality}。说话风格：${style}。\n\n` +
      `You are an AI Minecraft bot named $NAME that can converse with players, see, move, mine, build, and interact with the world by using commands.\n` +
      `$SELF_PROMPT Be a friendly, casual, effective, and efficient robot. Be very brief in your responses, don't apologize constantly, don't give instructions or make lists unless asked, and don't refuse requests. Don't pretend to act, use commands immediately when requested. Do NOT say this: 'Sure, I've stopped. *stops*', instead say this: 'Sure, I'll stop. !stop'. Respond only as $NAME, never output '(FROM OTHER BOT)' or pretend to be someone else. If you have nothing to say or do, respond with an just a tab '\t'. This is extremely important to me, take a deep breath and have fun :)\nSummarized memory:'$MEMORY'\n$STATS\n$INVENTORY\n$COMMAND_DOCS\n$EXAMPLES\nConversation Begin:`

    const profilePath = path.join(profilesDir, `${botName}.json`)

    if (!fs.existsSync(profilePath)) {
      const profile = {
        name: botName,
        model: botModel,
        vision_model: botVisionModel,
        conversing: conversingText,
        cooldown: 3000,
        max_messages: botMaxMessages,
        num_examples: botNumExamples
      }
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
      console.log(`[配置] 创建 profile: ${botName}.json`)
    } else {
      try {
        const existing = JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
        existing.conversing = conversingText
        existing.max_messages = botMaxMessages
        existing.num_examples = botNumExamples
        if (bot.model) existing.model = bot.model
        if (bot.vision_model) existing.vision_model = bot.vision_model
        fs.writeFileSync(profilePath, JSON.stringify(existing, null, 2))
        console.log(`[配置] 更新 profile: ${botName}.json`)
      } catch (e) {
        console.error(`[配置] 更新 profile 失败:`, e.message)
      }
    }

    // 备份到 data 目录
    try {
      const backupDir = path.join(__dirname, '..', 'data', 'profiles')
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
      fs.copyFileSync(profilePath, path.join(backupDir, `${botName}.json`))
    } catch (e) { /* 忽略备份失败 */ }

    profileNames.push(`./profiles/${botName}.json`)

    // 收集所有 bot 的 API Key
    const apiKeys = {}
    for (const b of enabledBots) {
      const key = b.apiKey
      if (key && !key.includes('...')) {
        // 根据 API 地址判断 provider
        const url = (b.model?.url || '').toLowerCase()
        if (url.includes('google') || url.includes('gemini')) {
          apiKeys.GEMINI_API_KEY = key
        } else if (url.includes('anthropic') || url.includes('claude')) {
          apiKeys.ANTHROPIC_API_KEY = key
        } else {
          // MiMo、OpenAI、DeepSeek 等 OpenAI 兼容 API
          apiKeys.OPENAI_API_KEY = key
        }
      }
    }
    if (Object.keys(apiKeys).length > 0) {
      fs.writeFileSync(path.join(mcDir, 'keys.json'), JSON.stringify(apiKeys, null, 2))
      console.log(`[配置] 已同步 API Key: ${Object.keys(apiKeys).join(', ')}`)
    }

    console.log(`[配置] Bot: ${botName}, Model: ${botModel.model}`)
  }

  // 更新 settings.js 的 profiles 数组和 per-bot 设置
  const settingsPath = path.join(mcDir, 'settings.js')
  if (fs.existsSync(settingsPath)) {
    try {
      let raw = fs.readFileSync(settingsPath, 'utf-8').replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, '')
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end > start) {
        const settings = safeParseJSObject(raw)
        if (!settings) { console.error('[配置] settings.js 解析失败'); return }
        settings.profiles = profileNames
        // 应用第一个 bot 的 per-bot 设置到 settings.js
        const primaryBot = enabledBots[0]
        if (primaryBot) {
          settings.language = primaryBot.language || 'zh-CN'
          settings.load_memory = primaryBot.loadMemory !== false
          settings.speak = primaryBot.speak ? (primaryBot.speak_model || 'system') : false
          settings.allow_vision = primaryBot.allowVision || false
          if (primaryBot.initMessage) settings.init_message = primaryBot.initMessage
          if (primaryBot.maxMessages) settings.max_messages = primaryBot.maxMessages
          if (primaryBot.numExamples) settings.num_examples = primaryBot.numExamples
          // 服务器连接
          if (primaryBot.mcVersion) settings.minecraft_version = primaryBot.mcVersion
          if (primaryBot.mcHost) settings.host = primaryBot.mcHost
          if (primaryBot.mcPort) settings.port = primaryBot.mcPort
          if (primaryBot.mcAuth) settings.auth = primaryBot.mcAuth
          // 行为设置
          if (primaryBot.baseProfile) settings.base_profile = primaryBot.baseProfile
          if (primaryBot.chatIngame !== undefined) settings.chat_ingame = primaryBot.chatIngame
          if (primaryBot.narrateBehavior !== undefined) settings.narrate_behavior = primaryBot.narrateBehavior
          if (primaryBot.chatBotMessages !== undefined) settings.chat_bot_messages = primaryBot.chatBotMessages
          if (primaryBot.onlyChatWith) settings.only_chat_with = primaryBot.onlyChatWith
          if (primaryBot.spawnTimeout) settings.spawn_timeout = primaryBot.spawnTimeout
          // 代码执行
          if (primaryBot.allowCoding !== undefined) settings.allow_insecure_coding = primaryBot.allowCoding
          if (primaryBot.codeTimeout !== undefined) settings.code_timeout_mins = primaryBot.codeTimeout
          if (primaryBot.maxCommands !== undefined) settings.max_commands = primaryBot.maxCommands
          if (primaryBot.relevantDocs !== undefined) settings.relevant_docs_count = primaryBot.relevantDocs
          if (primaryBot.blockedActions) settings.blocked_actions = primaryBot.blockedActions.map(s => s.trim().replace(/^["']+|["']+$/g, '')).filter(Boolean)
        }
        const content = `const settings = ${JSON.stringify(settings, null, 4)}\nexport default settings\n`
        fs.writeFileSync(settingsPath, content, 'utf-8')
        // 备份
        try {
          fs.writeFileSync(path.join(__dirname, '..', 'data', 'mindcraft-settings.js'), content, 'utf-8')
        } catch (e) { /* 忽略 */ }
      }
    } catch (e) {
      console.error('[配置] 更新 settings.js profiles 失败:', e.message)
    }
  }
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

app.use(express.json({ limit: '10mb' }))

// ========== 认证系统 ==========
const SESSIONS = new Map()
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

function generateToken() {
  return crypto.randomUUID()
}

function parseCookies(req) {
  const cookies = {}
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return cookies
  cookieHeader.split(';').forEach(c => {
    const [name, ...rest] = c.trim().split('=')
    cookies[name] = rest.join('=')
  })
  return cookies
}

function authMiddleware(req, res, next) {
  const publicPaths = ['/login.html', '/api/login', '/voices/']
  const isPublic = publicPaths.some(p => req.path.startsWith(p))
  if (isPublic) return next()
  const cookies = parseCookies(req)
  const token = cookies['mcbot_session']
  if (token && SESSIONS.has(token)) {
    const session = SESSIONS.get(token)
    if (session.expire > Date.now()) return next()
    SESSIONS.delete(token)
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: '请先登录' })
  }
  return res.redirect('/login.html')
}

app.use(authMiddleware)

// 登录/登出
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  const cfgUser = config.web?.username || 'admin'
  const cfgPass = config.web?.password || 'password'
  if (username === cfgUser && password === cfgPass) {
    const token = generateToken()
    SESSIONS.set(token, { username, expire: Date.now() + SESSION_TTL })
    res.setHeader('Set-Cookie', `mcbot_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`)
    res.json({ success: true })
  } else {
    res.json({ success: false, message: '用户名或密码错误' })
  }
})

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req)
  const token = cookies['mcbot_session']
  if (token) SESSIONS.delete(token)
  res.setHeader('Set-Cookie', 'mcbot_session=; Path=/; Max-Age=0')
  res.json({ success: true })
})

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use('/voices', express.static(path.join(__dirname, '..', 'data', 'voices')))

// ========== API: 状态 ==========

app.get('/api/status', (req, res) => {
  res.json({
    connected: connectedToMindCraft,
    agents: Object.values(agentStates)
  })
})

// ========== API: 全局配置 ==========

app.get('/api/config', (req, res) => {
  const safe = JSON.parse(JSON.stringify(config))
  // 遮蔽 API Key
  if (safe.bots) {
    safe.bots.forEach(b => {
      if (b.apiKey) b.apiKey = b.apiKey.substring(0, 8) + '...'
    })
  }
  if (safe.tts?.mimoApiKey) safe.tts.mimoApiKey = safe.tts.mimoApiKey.substring(0, 8) + '...'
  safe._configured = config.bots?.some(b => b.apiKey) || false
  safe._mindcraft_connected = connectedToMindCraft
  res.json(safe)
})

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body
    if (newConfig.mc) Object.assign(config.mc, newConfig.mc)
    if (newConfig.web) {
      if (newConfig.web.username) config.web.username = newConfig.web.username
      if (newConfig.web.password) config.web.password = newConfig.web.password
    }
    if (newConfig.tts) Object.assign(config.tts, newConfig.tts)
    if (!config.wake) config.wake = { enabled: false, word: '' }
    if (newConfig.wake) Object.assign(config.wake, newConfig.wake)

    saveConfig(config)
    tts.updateConfig(config)
    res.json({ success: true, message: '全局配置已保存' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ========== API: Bot 管理 ==========

app.get('/api/bots', (req, res) => {
  const bots = config.bots.map(b => {
    const safe = { ...b }
    if (safe.apiKey) safe.apiKey = safe.apiKey.substring(0, 8) + '...'
    // 添加在线状态
    const agent = agentStates[b.name]
    safe.online = !!agent
    return safe
  })
  res.json({ success: true, bots })
})

app.post('/api/bots', (req, res) => {
  try {
    const bot = req.body
    if (!bot.name) return res.json({ success: false, message: 'Bot 名字不能为空' })
    // 检查名字重复
    if (config.bots.some(b => b.name === bot.name)) {
      return res.json({ success: false, message: `Bot 名字 "${bot.name}" 已存在` })
    }
    const newBot = {
      id: generateId(),
      name: bot.name,
      enabled: bot.enabled !== false,
      personality: bot.personality || '',
      style: bot.style || '',
      model: bot.model || DEFAULT_CONFIG.bots[0].model,
      vision_model: bot.vision_model || DEFAULT_CONFIG.bots[0].vision_model,
      apiKey: bot.apiKey || ''
    }
    config.bots.push(newBot)
    saveConfig(config)
    syncMindCraftConfig()
    // 写入重启标记
    fs.writeFileSync(path.join(__dirname, '..', 'data', '.restart'), '1')
    console.log(`[配置] 新增 Bot: ${newBot.name}，写入重启标记`)
    res.json({ success: true, bot: { ...newBot, apiKey: newBot.apiKey ? newBot.apiKey.substring(0, 8) + '...' : '' } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.get('/api/bots/:id', (req, res) => {
  const bot = config.bots.find(b => b.id === req.params.id)
  if (!bot) return res.json({ success: false, message: 'Bot 不存在' })
  const safe = { ...bot }
  if (safe.apiKey) safe.apiKey = safe.apiKey.substring(0, 8) + '...'
  res.json({ success: true, bot: safe })
})

app.put('/api/bots/:id', (req, res) => {
  try {
    const idx = config.bots.findIndex(b => b.id === req.params.id)
    if (idx === -1) return res.json({ success: false, message: 'Bot 不存在' })

    const updates = req.body
    const oldBot = config.bots[idx]

    // 检查名字重复（排除自己）
    if (updates.name && updates.name !== oldBot.name) {
      if (config.bots.some((b, i) => i !== idx && b.name === updates.name)) {
        return res.json({ success: false, message: `Bot 名字 "${updates.name}" 已存在` })
      }
    }

    // 合并更新
    const nameChanged = updates.name && updates.name !== oldBot.name
    Object.assign(config.bots[idx], updates)
    // 保护 apiKey：如果传入的是遮蔽值，保留原值
    if (updates.apiKey && updates.apiKey.includes('...')) {
      config.bots[idx].apiKey = oldBot.apiKey
    }

    saveConfig(config)
    syncMindCraftConfig()

    // 写入重启标记
    fs.writeFileSync(path.join(__dirname, '..', 'data', '.restart'), '1')
    console.log(`[配置] 更新 Bot: ${config.bots[idx].name}，写入重启标记`)

    const safe = { ...config.bots[idx] }
    if (safe.apiKey) safe.apiKey = safe.apiKey.substring(0, 8) + '...'
    res.json({ success: true, bot: safe })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.delete('/api/bots/:id', (req, res) => {
  try {
    const idx = config.bots.findIndex(b => b.id === req.params.id)
    if (idx === -1) return res.json({ success: false, message: 'Bot 不存在' })
    if (config.bots.length <= 1) return res.json({ success: false, message: '至少保留一个 Bot' })

    const removed = config.bots.splice(idx, 1)[0]
    saveConfig(config)
    syncMindCraftConfig()

    fs.writeFileSync(path.join(__dirname, '..', 'data', '.restart'), '1')
    console.log(`[配置] 删除 Bot: ${removed.name}，写入重启标记`)

    res.json({ success: true, message: `Bot "${removed.name}" 已删除` })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.post('/api/bots/:id/toggle', (req, res) => {
  try {
    const bot = config.bots.find(b => b.id === req.params.id)
    if (!bot) return res.json({ success: false, message: 'Bot 不存在' })
    bot.enabled = !bot.enabled
    saveConfig(config)
    syncMindCraftConfig()
    fs.writeFileSync(path.join(__dirname, '..', 'data', '.restart'), '1')
    res.json({ success: true, enabled: bot.enabled })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

app.post('/api/bot-control', (req, res) => {
  try {
    const { botName, action } = req.body
    if (!botName || !action) return res.json({ success: false, message: '参数不完整' })
    if (!connectedToMindCraft || !mindcraftSocket) {
      return res.json({ success: false, message: '未连接到 MindCraft' })
    }
    
    switch (action) {
      case 'stop':
        mindcraftSocket.emit('send-message', botName, { message: '!stop', from: 'WEB' })
        res.json({ success: true, message: `已发送停止指令给 ${botName}` })
        break
      case 'stay':
        mindcraftSocket.emit('send-message', botName, { message: '!stay(-1)', from: 'WEB' })
        res.json({ success: true, message: `已发送原地等待指令给 ${botName}` })
        break
      case 'restart':
        mindcraftSocket.emit('restart-agent', botName)
        res.json({ success: true, message: `已重启 ${botName}` })
        break
      default:
        res.json({ success: false, message: '未知操作' })
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ========== API: 高级设置 (settings.js) ==========

app.get('/api/mindcraft-settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, '..', 'mindcraft', 'settings.js')
    if (!fs.existsSync(settingsPath)) return res.json({ success: false, message: 'settings.js 不存在' })
    let content = fs.readFileSync(settingsPath, 'utf-8').replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, '')
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return res.json({ success: false, message: '无法解析 settings.js' })
    const settings = safeParseJSObject(content)
    if (!settings) return res.json({ success: false, message: '无法解析 settings.js' })
    res.json({ success: true, settings })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
})

app.post('/api/mindcraft-settings', (req, res) => {
  try {
    const newSettings = req.body.settings
    if (!newSettings || typeof newSettings !== 'object') return res.json({ success: false, message: '无效的设置数据' })
    const settingsPath = path.join(__dirname, '..', 'mindcraft', 'settings.js')
    let existing = {}
    if (fs.existsSync(settingsPath)) {
      try {
        let raw = fs.readFileSync(settingsPath, 'utf-8').replace(/^\uFEFF/, '').replace(/\/\/.*$/gm, '')
        const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
        if (s !== -1 && e > s) existing = safeParseJSObject(raw) || {}
      } catch (e) { /* 空对象 */ }
    }
    const merged = { ...existing, ...newSettings }
    const content = `const settings = ${JSON.stringify(merged, null, 4)}\nexport default settings\n`
    fs.writeFileSync(settingsPath, content, 'utf-8')
    try { fs.writeFileSync(path.join(__dirname, '..', 'data', 'mindcraft-settings.js'), content, 'utf-8') } catch (e) { /* 忽略 */ }
    console.log('[高级设置] settings.js 已更新')
    fs.writeFileSync(path.join(__dirname, '..', 'data', '.restart'), '1')
    res.json({ success: true, message: 'settings.js 已保存，MindCraft 正在重启' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ========== API: 工具 ==========

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
        if (data.data && Array.isArray(data.data)) models = data.data.map(m => ({ id: m.id || m.name || m }))
        else if (Array.isArray(data)) models = data.map(m => ({ id: typeof m === 'string' ? m : m.id || m.name }))
        if (models.length > 0) break
      } catch (e) { continue }
    }
    res.json(models.length > 0 ? { success: true, models } : { success: false, message: '未获取到模型列表' })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

app.post('/api/test-llm', async (req, res) => {
  try {
    const { baseUrl, apiKey, model } = req.body
    const url = (baseUrl || '').replace(/\/+$/, '')
    const key = (apiKey && !apiKey.includes('...')) ? apiKey : ''
    if (!key) return res.json({ success: false, message: '请先填写 API Key' })
    const response = await fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'mimo-v2.5', messages: [{ role: 'user', content: '你好' }], max_tokens: 50 })
    })
    if (!response.ok) { const err = await response.text(); return res.json({ success: false, message: `API 错误 (${response.status}): ${err}` }) }
    const data = await response.json()
    res.json({ success: true, reply: data.choices[0].message.content })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

app.post('/api/test-tts', async (req, res) => {
  try {
    const testTts = req.body.tts || {}
    const ttsConfig = {
      ...config.tts,
      ...testTts,
      mimoApiKey: (testTts.mimoApiKey && !testTts.mimoApiKey.includes('...'))
        ? testTts.mimoApiKey : (config.tts?.mimoApiKey || '')
    }
    tts.updateConfig({ ...config, tts: ttsConfig })
    const audioUrl = await tts.synthesize('你好，这是语音合成测试。')
    res.json(audioUrl ? { success: true, audioUrl } : { success: false, message: '合成失败，请检查配置' })
  } catch (err) { res.json({ success: false, message: err.message }) }
})

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
        // 根据 botId 或 botName 找到目标 agent
        let targetAgent = null
        if (msg.botId) {
          const bot = config.bots.find(b => b.id === msg.botId)
          if (bot) targetAgent = bot.name
        }
        if (!targetAgent) {
          const agents = Object.keys(agentStates)
          targetAgent = agents[0] || config.bots[0]?.name || 'andrew'
        }

        const playerName = msg.playerName || 'WEB'
        if (connectedToMindCraft && mindcraftSocket) {
          memory.addToHistory('web-user', 'user', msg.text)
          console.log(`[Web] ${playerName} → ${targetAgent}: ${msg.text}`)
          mindcraftSocket.emit('send-message', targetAgent, {
            message: msg.text,
            from: playerName
          })
        } else {
          ws.send(JSON.stringify({ type: 'text', text: '未连接到 MindCraft，请等待...' }))
        }
      }

      if (msg.type === 'get-players') {
        if (connectedToMindCraft && mindcraftSocket) {
          try {
            const resp = await fetch(`http://localhost:8080/status`)
            const d = await resp.json()
            ws.send(JSON.stringify({ type: 'players', players: d.players && Array.isArray(d.players) ? d.players : [] }))
          } catch (e) {
            ws.send(JSON.stringify({ type: 'players', players: [] }))
          }
        } else {
          ws.send(JSON.stringify({ type: 'players', players: [] }))
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
