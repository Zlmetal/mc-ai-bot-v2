/**
 * stt.js - 语音转文字（Whisper 本地模型）
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp')

export default class STTService {
  constructor() {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true })
    }
    this.ready = false
    this._init()
  }

  _init() {
    try {
      // 检查 faster-whisper 是否安装
      execSync('python3 -c "import faster_whisper"', { stdio: 'ignore' })
      this.ready = true
      console.log('[STT] ✅ faster-whisper 已就绪')
    } catch {
      console.log('[STT] 安装 faster-whisper...')
      try {
        execSync('pip3 install faster-whisper --break-system-packages', { 
          stdio: 'ignore', 
          timeout: 120000 
        })
        this.ready = true
        console.log('[STT] ✅ faster-whisper 安装完成')
      } catch (e) {
        console.error('[STT] ❌ 安装失败:', e.message)
        this.ready = false
      }
    }
  }

  /**
   * 将音频 buffer 转为文字
   * @param {Buffer} audioBuffer - webm/ogg/wav 格式的音频
   * @returns {string} 识别出的文字
   */
  async transcribe(audioBuffer) {
    if (!this.ready) throw new Error('STT 未就绪')

    // 保存临时文件
    const filename = `stt_${Date.now()}.webm`
    const filePath = path.join(TEMP_DIR, filename)
    fs.writeFileSync(filePath, audioBuffer)

    try {
      // 调用 Python Whisper
      const script = `
import sys
from faster_whisper import WhisperModel
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe("${filePath.replace(/\\/g, '\\\\')}", language="zh")
text = " ".join([s.text for s in segments])
print(text)
`
      const scriptPath = path.join(TEMP_DIR, 'transcribe.py')
      fs.writeFileSync(scriptPath, script)

      const result = execSync(`python3 "${scriptPath}"`, {
        timeout: 30000,
        encoding: 'utf-8'
      }).trim()

      return result
    } finally {
      // 清理临时文件
      try { fs.unlinkSync(filePath) } catch {}
      try { fs.unlinkSync(path.join(TEMP_DIR, 'transcribe.py')) } catch {}
    }
  }
}
