/**
 * memory.js - SQLite 记忆系统
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default class MemorySystem {
  constructor(dbPath = path.join(__dirname, '..', 'data', 'memories.db')) {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this._initTables()
    this.conversations = new Map()

    console.log('[记忆] SQLite 初始化完成')
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        entity TEXT,
        content TEXT NOT NULL,
        location TEXT,
        importance INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        archived INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS identity (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS relationships (
        player_name TEXT PRIMARY KEY,
        disposition TEXT DEFAULT 'neutral',
        trust_level INTEGER DEFAULT 3,
        notes TEXT,
        met_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS locations (
        name TEXT PRIMARY KEY,
        x INTEGER, y INTEGER, z INTEGER,
        description TEXT,
        discovered_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity);
    `)
  }

  setIdentity(key, value) {
    this.db.prepare(`
      INSERT OR REPLACE INTO identity (key, value, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'))
    `).run(key, value)
  }

  getIdentity(key) {
    const row = this.db.prepare('SELECT value FROM identity WHERE key = ?').get(key)
    return row ? row.value : null
  }

  getAllIdentity() {
    const rows = this.db.prepare('SELECT key, value FROM identity ORDER BY key').all()
    return rows.map(r => `${r.key}：${r.value}`).join('\n')
  }

  remember(type, content, options = {}) {
    const { entity = null, location = null, importance = 3 } = options
    this.db.prepare(`
      INSERT INTO memories (type, entity, content, location, importance)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, content, entity, location, importance)
  }

  recall(query, options = {}) {
    const { entity = null, limit = 10 } = options
    let sql = `SELECT * FROM memories WHERE archived = 0 AND (content LIKE ?`
    const params = [`%${query}%`]
    if (entity) {
      sql += ` OR entity = ?`
      params.push(entity)
    }
    sql += `) ORDER BY importance DESC, created_at DESC LIMIT ?`
    params.push(limit)
    return this.db.prepare(sql).all(...params)
  }

  getRecent(type, limit = 5) {
    return this.db.prepare(`
      SELECT * FROM memories WHERE type = ? AND archived = 0
      ORDER BY created_at DESC LIMIT ?
    `).all(type, limit)
  }

  setRelationship(playerName, disposition, trustLevel, notes) {
    this.db.prepare(`
      INSERT OR REPLACE INTO relationships (player_name, disposition, trust_level, notes)
      VALUES (?, ?, ?, ?)
    `).run(playerName, disposition, trustLevel, notes)
  }

  getAllRelationships() {
    const rows = this.db.prepare('SELECT * FROM relationships').all()
    if (rows.length === 0) return '暂无记录'
    return rows.map(r =>
      `${r.player_name}：${r.disposition}（信任度 ${r.trust_level}/5）${r.notes ? ' - ' + r.notes : ''}`
    ).join('\n')
  }

  saveLocation(name, x, y, z, description) {
    this.db.prepare(`
      INSERT OR REPLACE INTO locations (name, x, y, z, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, x, y, z, description)
  }

  getAllLocations() {
    const rows = this.db.prepare('SELECT * FROM locations').all()
    if (rows.length === 0) return '暂无记录'
    return rows.map(r =>
      `${r.name}：(${r.x}, ${r.y}, ${r.z}) - ${r.description || '无描述'}`
    ).join('\n')
  }

  addToHistory(userId, role, content) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, [])
    }
    const history = this.conversations.get(userId)
    history.push({ role, content, timestamp: Date.now() })
    if (history.length > 30) {
      const archived = history.splice(0, 10)
      const summary = archived.filter(m => m.role === 'user').map(m => m.content).join('；')
      if (summary) this.remember('conversation', summary, { entity: userId, importance: 2 })
    }
  }

  getHistory(userId, limit = 20) {
    const history = this.conversations.get(userId) || []
    return history.slice(-limit)
  }

  close() {
    this.db.close()
  }
}
