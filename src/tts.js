/**
 * tts.js - Edge-TTS 语音合成
 * 使用 Microsoft Edge TTS，免费、稳定、中文音色好
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Edge-TTS 内置中文音色
const VOICES = {
  '晓晓（女）': 'zh-CN-XiaoxiaoNeural',
  '晓伊（女）': 'zh-CN-XiaoyiNeural',
  '云希（男）': 'zh-CN-YunxiNeural',
  '云扬（男）': 'zh-CN-YunyangNeural',
  '云健（男）': 'zh-CN-YunjianNeural',
  '云夏（男）': 'zh-CN-YunxiaNeural',
  '晓萱（女）': 'zh-CN-XiaoxuanNeural',
  '晓辰（女）': 'zh-CN-XiaochenNeural'
}

export default class TTSService {
  constructor(config) {
    this.config = config
    this.enabled = config.tts?.enabled !== false
    this.voice = config.tts?.voice || '云希（男）'
    this.edgeVoice = VOICES[this.voice] || 'zh-CN-YunxiNeural'

    this.audioDir = path.join(__dirname, '..', 'data', 'voices')
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true })
    }

    // 检查 edge-tts 是否安装
    this._checkEdgeTTS()
    this._cleanOldFiles()
  }

  _checkEdgeTTS() {
    try {
      execSync('pip show edge-tts', { stdio: 'ignore' })
      console.log('[TTS] ✅ edge-tts 已安装')
    } catch {
      console.log('[TTS] 安装 edge-tts...')
      try {
        execSync('pip install edge-tts', { stdio: 'ignore' })
        console.log('[TTS] ✅ edge-tts 安装完成')
      } catch (e) {
        console.error('[TTS] ❌ edge-tts 安装失败:', e.message)
        this.enabled = false
      }
    }
  }

  updateConfig(config) {
    this.config = config
    this.enabled = config.tts?.enabled !== false
    this.voice = config.tts?.voice || '云希（男）'
    this.edgeVoice = VOICES[this.voice] || 'zh-CN-YunxiNeural'
  }

  async synthesize(text) {
    if (!this.enabled || !text || text.trim().length === 0) return null

    const filename = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`
    const filePath = path.join(this.audioDir, filename)

    try {
      // 使用 edge-tts 命令行
      execSync(
        `edge-tts --voice "${this.edgeVoice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${filePath}"`,
        { timeout: 15000, stdio: 'ignore' }
      )
      return `/voices/${filename}`
    } catch (err) {
      console.error('[TTS] 合成失败:', err.message)
      return null
    }
  }

  async synthesizeToFile(text) {
    return await this.synthesize(text)
  }

  async synthesizeStream(text) {
    const sentences = this._splitSentences(text)
    const results = []
    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue
      const audioUrl = await this.synthesize(sentence)
      results.push({ text: sentence, audioUrl })
    }
    return results
  }

  _splitSentences(text) {
    const parts = text.split(/([。！？；!?;])/)
    const sentences = []
    for (let i = 0; i < parts.length - 1; i += 2) {
      sentences.push(parts[i] + (parts[i + 1] || ''))
    }
    if (parts.length % 2 === 1 && parts[parts.length - 1].trim()) {
      sentences.push(parts[parts.length - 1])
    }
    if (sentences.length === 0 && text.trim()) sentences.push(text)
    return sentences
  }

  _cleanOldFiles() {
    try {
      const files = fs.readdirSync(this.audioDir)
      const oneHourAgo = Date.now() - 3600 * 1000
      for (const file of files) {
        const filePath = path.join(this.audioDir, file)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < oneHourAgo) fs.unlinkSync(filePath)
      }
    } catch (e) { /* ignore */ }
  }

  // 获取音色列表（供设置页面使用）
  static getVoiceList() {
    return Object.entries(VOICES).map(([name, id]) => ({ name, id }))
  }
}
