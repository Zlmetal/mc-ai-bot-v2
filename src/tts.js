/**
 * tts.js - 语音合成服务
 * 支持 Edge-TTS（免费）和 MiMo TTS（API）
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import fetch from 'node-fetch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Edge-TTS 内置中文音色
const EDGE_VOICES = {
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
    this.mode = config.tts?.mode || 'edge'  // 'edge' 或 'mimo'
    this.voice = config.tts?.voice || '云希（男）'

    // MiMo TTS 配置
    this.mimoBaseUrl = config.tts?.mimoBaseUrl || config.llm?.baseUrl || 'https://api.xiaomimimo.com/v1'
    this.mimoApiKey = config.tts?.mimoApiKey || config.llm?.apiKey || ''
    this.mimoModel = config.tts?.mimoModel || 'mimo-v2.5-tts'
    this.mimoVoice = config.tts?.mimoVoice || 'Chloe'

    this.audioDir = path.join(__dirname, '..', 'data', 'voices')
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true })
    }

    if (this.mode === 'edge') {
      this._checkEdgeTTS()
    }
  }

  _checkEdgeTTS() {
    try {
      execSync('pip show edge-tts', { stdio: 'ignore' })
    } catch {
      try {
        execSync('pip install edge-tts', { stdio: 'ignore' })
      } catch (e) {
        console.error('[TTS] edge-tts 安装失败:', e.message)
      }
    }
  }

  updateConfig(config) {
    this.config = config
    this.enabled = config.tts?.enabled !== false
    this.mode = config.tts?.mode || 'edge'
    this.voice = config.tts?.voice || '云希（男）'
    this.mimoBaseUrl = config.tts?.mimoBaseUrl || config.llm?.baseUrl || 'https://api.xiaomimimo.com/v1'
    this.mimoApiKey = config.tts?.mimoApiKey || config.llm?.apiKey || ''
    this.mimoModel = config.tts?.mimoModel || 'mimo-v2.5-tts'
    this.mimoVoice = config.tts?.mimoVoice || 'Chloe'
  }

  // 清理文本中的 Markdown 符号
  _cleanText(text) {
    if (!text) return ''
    let t = text
    t = t.replace(/^#{1,6}\s+/gm, '')
    t = t.replace(/\*\*(.+?)\*\*/g, '$1')
    t = t.replace(/\*(.+?)\*/g, '$1')
    t = t.replace(/^[\s]*[-*+]\s+/gm, '')
    t = t.replace(/`([^`]+)`/g, '$1')
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    t = t.replace(/[#*_~`>]/g, '')
    t = t.replace(/\n{3,}/g, '\n\n')
    return t.trim()
  }

  async synthesize(text) {
    if (!this.enabled || !text || text.trim().length === 0) return null
    text = this._cleanText(text)
    if (!text) return null

    if (this.mode === 'mimo') {
      return this._synthesizeMiMo(text)
    }
    return this._synthesizeEdge(text)
  }

  // Edge-TTS 合成
  async _synthesizeEdge(text) {
    const filename = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`
    const filePath = path.join(this.audioDir, filename)
    const edgeVoice = EDGE_VOICES[this.voice] || 'zh-CN-YunxiNeural'

    try {
      execSync(
        `edge-tts --voice "${edgeVoice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${filePath}"`,
        { timeout: 15000, stdio: 'ignore' }
      )
      return `/voices/${filename}`
    } catch (err) {
      console.error('[TTS] Edge 合成失败:', err.message)
      return null
    }
  }

  // MiMo TTS 合成（通过 chat completions 接口）
  async _synthesizeMiMo(text) {
    if (!this.mimoApiKey) {
      console.error('[TTS] MiMo API Key 未配置')
      return null
    }

    const filename = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`
    const filePath = path.join(this.audioDir, filename)

    try {
      const baseUrl = this.mimoBaseUrl.replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.mimoApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.mimoModel,
          modalities: ["text", "audio"],
          audio: { voice: this.mimoVoice, format: "mp3" },
          messages: [
            { role: "user", content: text }
          ]
        })
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('[TTS] MiMo 合成失败:', response.status, err)
        return null
      }

      const data = await response.json()
      const audioData = data.choices?.[0]?.message?.audio?.data
      if (!audioData) {
        console.error('[TTS] MiMo 返回无音频数据')
        return null
      }

      // 解码 base64 音频
      const buffer = Buffer.from(audioData, 'base64')
      fs.writeFileSync(filePath, buffer)
      return `/voices/${filename}`
    } catch (err) {
      console.error('[TTS] MiMo 请求异常:', err.message)
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
}
