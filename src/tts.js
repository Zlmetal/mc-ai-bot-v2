/**
 * tts.js - MiMo TTS 语音合成
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default class TTSService {
  constructor(config) {
    this.config = config
    // TTS 专用 API 地址和 Key，没有则回退到 LLM 的
    this.baseUrl = config.tts?.baseUrl || config.llm?.baseUrl || ''
    this.apiKey = config.tts?.apiKey || config.llm?.apiKey || ''
    this.model = config.tts?.model || 'mimo-v2.5-tts-voicedesign'
    this.voice = config.tts?.voice || '温柔的年轻男性'
    this.enabled = config.tts?.enabled !== false

    this.audioDir = path.join(__dirname, '..', 'data', 'voices')
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true })
    }

    this._cleanOldFiles()
  }

  updateConfig(config) {
    this.config = config
    this.baseUrl = config.tts?.baseUrl || config.llm?.baseUrl || ''
    this.apiKey = config.tts?.apiKey || config.llm?.apiKey || ''
    this.model = config.tts?.model || 'mimo-v2.5-tts-voicedesign'
    this.voice = config.tts?.voice || '温柔的年轻男性'
    this.enabled = config.tts?.enabled !== false
  }

  async synthesize(text) {
    if (!this.enabled || !text || !this.apiKey) return null

    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: this.voice,
          response_format: 'mp3'
        })
      })

      if (!response.ok) {
        console.error('[TTS] 合成失败:', response.status)
        return null
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      return buffer
    } catch (err) {
      console.error('[TTS] 请求异常:', err.message)
      return null
    }
  }

  async synthesizeToFile(text) {
    const buffer = await this.synthesize(text)
    if (!buffer) return null

    const filename = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`
    const filePath = path.join(this.audioDir, filename)
    fs.writeFileSync(filePath, buffer)
    return `/voices/${filename}`
  }

  async synthesizeStream(text) {
    const sentences = this._splitSentences(text)
    const results = []
    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue
      const audioUrl = await this.synthesizeToFile(sentence)
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
}
