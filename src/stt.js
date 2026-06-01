/**
 * stt.js - 语音转文字（Whisper 本地模型）
 * 模型预加载，避免每次识别都重新加载
 */

import { spawn, execSync } from 'child_process'
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
    this._worker = null
    this._pendingResolve = null
    this._init()
  }

  _init() {
    try {
      execSync('python3 -c "import faster_whisper"', { stdio: 'ignore' })
      this._startWorker()
    } catch {
      console.log('[STT] 安装 faster-whisper...')
      try {
        execSync('pip3 install faster-whisper --break-system-packages', {
          stdio: 'ignore',
          timeout: 120000
        })
        this._startWorker()
      } catch (e) {
        console.error('[STT] ❌ 安装失败:', e.message)
        this.ready = false
      }
    }
  }

  _startWorker() {
    const workerScript = `
import sys
import json
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")
print("READY", flush=True)

while True:
    line = sys.stdin.readline()
    if not line:
        break
    line = line.strip()
    if not line:
        continue
    try:
        segments, info = model.transcribe(line, language="zh", beam_size=5)
        text = " ".join([s.text.strip() for s in segments])
        print(json.dumps({"success": True, "text": text}), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), flush=True)
`
    const workerPath = path.join(TEMP_DIR, 'stt_worker.py')
    fs.writeFileSync(workerPath, workerScript)

    this._worker = spawn('python3', [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this._worker.stdout.on('data', (data) => {
      const line = data.toString().trim()
      if (line === 'READY') {
        this.ready = true
        console.log('[STT] ✅ Whisper 模型已预加载')
        return
      }
      if (this._pendingResolve) {
        try {
          const result = JSON.parse(line)
          this._pendingResolve(result)
        } catch (e) {
          this._pendingResolve({ success: false, error: '解析失败' })
        }
        this._pendingResolve = null
      }
    })

    this._worker.stderr.on('data', () => {})

    this._worker.on('exit', () => {
      console.log('[STT] Worker 进程退出，将在下次使用时重启')
      this.ready = false
      this._worker = null
      setTimeout(() => this._startWorker(), 3000)
    })

    setTimeout(() => {
      if (!this.ready) {
        console.error('[STT] ❌ 模型加载超时')
        if (this._worker) this._worker.kill()
      }
    }, 60000)
  }

  async transcribe(audioBuffer) {
    if (!this.ready || !this._worker) throw new Error('STT 未就绪')

    const filename = `stt_${Date.now()}.webm`
    const filePath = path.join(TEMP_DIR, filename)
    fs.writeFileSync(filePath, audioBuffer)

    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this._pendingResolve = null
          reject(new Error('STT 识别超时'))
        }, 30000)

        this._pendingResolve = (result) => {
          clearTimeout(timeout)
          if (result.success) resolve(result.text)
          else reject(new Error(result.error))
        }

        this._worker.stdin.write(filePath + '\n')
      })
    } finally {
      try { fs.unlinkSync(filePath) } catch {}
    }
  }

  close() {
    if (this._worker) {
      this._worker.kill()
      this._worker = null
    }
  }
}
