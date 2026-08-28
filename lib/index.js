// dsh-projects-mode v0.3 — Host half.
// Project mode for the DSH web GUI: sidebar entry + full-screen manager + live
// project context injection (instructions via system-prompt section, memory
// via replaceable pre-step block) + auto project briefing distilled from the
// project's recent sessions (token-saving handoff) + real last-activity time
// from session log mtimes. Data: single JSON file (v3 schema adds autoBrief).

import { readFile, writeFile, readdir, stat, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API_PREFIX = '/projects-mode/api'
const DATA_FILE = process.env.DSH_PROJECTS_FILE || join(homedir(), '.dsh', '.dsh-projects.json')
const SESSIONS_ROOT = join(homedir(), '.dsh', 'sessions')
const BODY_LIMIT = 256 * 1024
const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' }
const SECTION_NAME = 'projects-mode:context'
const SECTION_ORDER = 300

/** In-memory authoritative state. */
const state = {
  loaded: false,
  persistOk: true,
  data: { version: 3, projects: [], assignments: {} },
}

/** activity mtime cache: sessionId -> ms; invalidated on a slow tick. */
let activityCache = new Map()
let activityScanAt = 0
const ACTIVITY_TTL_MS = 5000

/** Auto-briefing cache: sessionId -> { text, at }; regenerated after 30 min. */
const briefCache = new Map()
const BRIEF_TTL_MS = 30 * 60 * 1000

function cleanProject(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    instructions: p.instructions || '',
    memory: p.memory || '',
    autoBrief: p.autoBrief !== false,
    createdAt: p.createdAt || 0,
  }
}

async function loadData() {
  if (state.loaded) return state.data
  state.loaded = true
  try {
    const text = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      const raw = Array.isArray(parsed.projects) ? parsed.projects : []
      const projects = raw
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
        .map(cleanProject)
      const assignments =
        parsed.assignments && typeof parsed.assignments === 'object' && !Array.isArray(parsed.assignments)
          ? { ...parsed.assignments }
          : {}
      state.data = { version: 3, projects, assignments }
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') console.error('[projects-mode] load failed:', error)
  }
  return state.data
}

async function saveData() {
  try {
    const tmp = join(DATA_FILE + '.tmp-' + Date.now())
    await writeFile(tmp, JSON.stringify(state.data, null, 2), 'utf8')
    await rename(tmp, DATA_FILE)
    state.persistOk = true
    return true
  } catch (error) {
    console.error('[projects-mode] save failed:', error)
    state.persistOk = false
    return false
  }
}

function newId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/** Real last-activity time: max mtime of the session log file for one id. */
async function activityFor(sessionId) {
  if (activityCache.has(sessionId)) return activityCache.get(sessionId)
  const now = Date.now()
  if (now - activityScanAt > ACTIVITY_TTL_MS) {
    activityCache = new Map()
    activityScanAt = now
  }
  let best = 0
  let slugs = []
  try {
    slugs = await readdir(SESSIONS_ROOT)
  } catch (e) {
    slugs = []
  }
  for (const slug of slugs) {
    try {
      const info = await stat(join(SESSIONS_ROOT, slug, sessionId, 'session.jsonl.zstd'))
      if (info.mtimeMs > best) best = info.mtimeMs
    } catch (e) {
      /* not in this slug */
    }
  }
  activityCache.set(sessionId, best)
  return best
}

/** Session corpus read with real activity times and batch titles. */
async function listSessions(ctx) {
  const sq = ctx.get('sessionQuery')
  const base = []
  if (sq && typeof sq.listSessions === 'function') {
    try {
      const raw = await sq.listSessions()
      if (Array.isArray(raw)) {
        for (const r of raw) {
          if (!r || typeof r !== 'object') continue
          const header = r.header
          if (!header || typeof header !== 'object') continue
          const id = typeof header.id === 'string' ? header.id : ''
          if (!id) continue
          if (header.origin === 'subagent') continue
          base.push({
            id,
            createdAt: typeof header.createdAt === 'number' ? header.createdAt : 0,
            title: '',
            titleUpdatedAt: 0,
          })
        }
      }
    } catch (error) {
      console.error('[projects-mode] listSessions failed:', error)
    }
  }
  if (base.length > 0 && sq && typeof sq.readTitleSnapshots === 'function') {
    try {
      const ids = base.slice(0, 200).map((b) => b.id)
      const obs = await sq.readTitleSnapshots(ids)
      if (Array.isArray(obs)) {
        const byId = {}
        for (const b of base) byId[b.id] = b
        for (const o of obs) {
          if (!o || typeof o !== 'object' || o.status !== 'fulfilled') continue
          const value = o.value
          if (!value || typeof value !== 'object') continue
          const snap = value.title
          if (!snap || typeof snap.title !== 'string' || !snap.title) continue
          const b = byId[o.sessionId]
          if (!b) continue
          b.title = snap.title
          b.titleUpdatedAt = typeof snap.updatedAt === 'number' ? snap.updatedAt : 0
        }
      }
    } catch (error) {
      console.error('[projects-mode] readTitleSnapshots failed:', error)
    }
  }
  const data = await loadData()
  const items = []
  for (const b of base.slice(0, 200)) {
    const activity = await activityFor(b.id)
    items.push({
      id: b.id,
      title: b.title || ('会话 · ' + (b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : b.id.slice(0, 8))),
      updatedAt: Math.max(activity, b.titleUpdatedAt || 0, b.createdAt || 0),
      projectId: data.assignments[b.id] || null,
    })
  }
  items.sort((a, b) => b.updatedAt - a.updatedAt)
  return items
}

/** Build the live context section text for one session's project (or ''). */
function contextSectionText(data, sessionId) {
  const pid = data.assignments[sessionId]
  if (!pid) return ''
  const project = data.projects.find((p) => p.id === pid)
  if (!project) return ''
  const lines = [`当前会话属于项目「${project.name}」。`]
  if (project.description) lines.push(`项目简介：${project.description}`)
  if ((project.instructions || '').trim()) {
    lines.push('')
    lines.push('项目指令（本项目所有会话共用，实时生效）：')
    lines.push(project.instructions.trim())
  }
  return lines.join('\n')
}

/** Build the memory snapshot block prepended/refreshed in step messages. */
function memoryBlockText(project) {
  const mem = (project.memory || '').trim()
  if (!mem) return ''
  return `[项目共享记忆 — 来自项目「${project.name}」，与最新指令冲突时以最新为准]\n\n${mem}`
}

/** Pull plain text out of a Message content field (string or block array). */
function textFromContent(content) {
  try {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((b) => b && typeof b === 'object' && (b.type === 'text' || typeof b.text === 'string'))
        .map((b) => b.text || '')
        .join(' ')
    }
  } catch (e) {
    /* defensive */
  }
  return ''
}

/** Extract the opening human request of one session (first direct user text). */
function firstUserAsk(events) {
  try {
    for (const ev of Array.isArray(events) ? events : []) {
      if (!ev || ev.type !== 'user/message') continue
      const msg = ev.data && typeof ev.data === 'object' && !Array.isArray(ev.data) ? ev.data : ev
      const src = msg.source && typeof msg.source === 'object' ? msg.source : null
      // Skip synthetic injections (file-change notices, skill content, …);
      // keep direct prompts whose source kind is absent or human-ish.
      if (src && typeof src.kind === 'string' && src.kind !== 'human' && src.kind !== 'user') continue
      const text = textFromContent(msg.content).replace(/\s+/g, ' ').trim()
      if (text.length >= 6) return text
    }
  } catch (e) {
    /* defensive */
  }
  return ''
}

function briefDate(ts) {
  if (!ts) return ''
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return days + ' 天前'
  return new Date(ts).toISOString().slice(0, 10)
}

/**
 * Auto project briefing: distilled from the project's most recent sessions
 * (title + opening request each). This is the token-saving handoff — a fresh
 * session inherits context worth ~hundreds of tokens instead of dragging the
 * whole history of an old session (thousands per step).
 */
async function buildBriefing(ctx, project, currentSessionId) {
  let items = []
  try {
    items = await listSessions(ctx)
  } catch (e) {
    return ''
  }
  const mine = items.filter((s) => s.projectId === project.id && s.id !== currentSessionId).slice(0, 6)
  if (mine.length === 0) return ''
  const sq = ctx.get('sessionQuery')
  const lines = []
  for (const s of mine) {
    let ask = ''
    if (sq && typeof sq.load === 'function') {
      try {
        const ls = await sq.load(s.id)
        ask = firstUserAsk(ls && ls.events)
      } catch (e) {
        /* session may be unloadable; title still carries signal */
      }
    }
    if (ask.length > 160) ask = ask.slice(0, 160) + '…'
    lines.push(`- 「${String(s.title || '').slice(0, 40)}」(${briefDate(s.updatedAt)})${ask ? '：' + ask : ''}`)
  }
  if (lines.length === 0) return ''
  return [
    `[项目简报 — 自动生成自项目「${project.name}」最近的会话，用于接续此前工作，无需向用户重复询问背景]`,
    '本项目近期会话概览（新→旧）：',
    ...lines,
  ].join('\n')
}

export const inject = []

export async function apply(ctx) {
  await loadData()

  const webServer = ctx.get('webServer')
  if (webServer === undefined || typeof webServer.register !== 'function') {
    console.error('[projects-mode] webServer unavailable; API disabled')
    return
  }

  // Live per-session project context section (instructions render fresh at
  // every assembly; empty string is filtered out of the prompt).
  try {
    const sp = ctx.get('systemPrompt')
    if (sp && typeof sp.section === 'function') {
      sp.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text: (assembleContext) => {
          try {
            const agent = assembleContext && assembleContext.scope
            const sessionId = (agent && agent.session && agent.session.id) || (agent && agent.id) || ''
            if (!sessionId) return ''
            return contextSectionText(state.data, String(sessionId))
          } catch (e) {
            return ''
          }
        },
      })
    } else {
      console.warn('[projects-mode] systemPrompt unavailable; live instructions disabled')
    }
  } catch (e) {
    console.error('[projects-mode] section registration failed:', e)
  }

  // Replaceable context blocks injected into every step (and thus surviving
  // compaction): memory ('projects-mode/memory') and the auto project briefing
  // ('projects-mode/brief'). Both are dropped from the claimed messages and
  // re-inserted fresh each step; the briefing text itself is generated once
  // per session and cached (BRIEF_TTL_MS).
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    try {
      if (!decision || decision.kind !== 'enter' || !decision.messages || decision.messages.length === 0) return decision
      const agent = payload && payload.agent
      const sessionId = String((agent && agent.session && agent.session.id) || (agent && agent.id) || '')
      if (!sessionId) return decision
      const pid = state.data.assignments[sessionId]
      if (!pid) return decision
      const project = state.data.projects.find((p) => p.id === pid)
      if (!project) return decision
      const want = memoryBlockText(project)

      // Auto briefing: generated lazily on the session's first step, then
      // reused (cheap) so the block can be refreshed in place every step.
      let briefText = ''
      if (project.autoBrief) {
        const cached = briefCache.get(sessionId)
        if (cached && Date.now() - cached.at < BRIEF_TTL_MS) {
          briefText = cached.text
        } else {
          try {
            briefText = await buildBriefing(ctx, project, sessionId)
          } catch (e) {
            briefText = ''
          }
          briefCache.set(sessionId, { text: briefText, at: Date.now() })
        }
      }

      // Hand-built user messages (Message shape: id/role/content/source) —
      // avoids a hard dependency on @deepseek-ai/dsh-llm at runtime.
      const makeBlock = (prefix, kind, text) =>
        Object.freeze({
          id: prefix + randomUUID(),
          role: 'user',
          content: [{ type: 'text', text }],
          source: { kind, form: 'context' },
        })
      const isCtxMsg = (m) =>
        !!(m && typeof m === 'object' && m.source && typeof m.source === 'object' &&
          (m.source.kind === 'projects-mode/memory' || m.source.kind === 'projects-mode/brief'))

      // Oldest context first: briefing, then memory (closest to the live
      // conversation, so it wins if the two ever conflict).
      const blocks = []
      if (briefText) blocks.push(makeBlock('pbrief-', 'projects-mode/brief', briefText))
      if (want) blocks.push(makeBlock('pmem-', 'projects-mode/memory', want))

      const rewritten = []
      for (const m of decision.messages) {
        if (isCtxMsg(m)) continue // drop older/duplicate blocks; re-added below
        rewritten.push(m)
      }
      if (blocks.length > 0) rewritten.unshift(...blocks)
      return { ...decision, messages: rewritten }
    } catch (e) {
      console.error('[projects-mode] context injection failed:', e)
      return decision
    }
  })

  function writeJson(res, status, body) {
    res.writeHead(status, JSON_HEADERS)
    res.end(JSON.stringify(body))
  }

  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > BODY_LIMIT) throw new Error('body-too-large')
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw.length === 0 ? {} : JSON.parse(raw)
  }

  function isLoopbackRequest(req) {
    const remote = req.socket && req.socket.remoteAddress
    if (typeof remote !== 'string') return false
    const n = remote.toLowerCase()
    if (n === '::1') return true
    const v4 = n.startsWith('::ffff:') ? n.slice(7) : n
    const parts = v4.split('.')
    return parts.length === 4 && parts[0] === '127' && parts.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255)
  }

  function guarded(handler) {
    return async (req, res) => {
      try {
        if (!isLoopbackRequest(req)) return writeJson(res, 403, { ok: false, error: 'forbidden' })
        await handler(req, res)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!res.headersSent) writeJson(res, message === 'body-too-large' ? 413 : 400, { ok: false, error: message })
        else res.end()
      }
    }
  }

  const actions = {
    async create(body) {
      const data = await loadData()
      const name = String(body.name || '').trim()
      if (!name) throw new Error('项目名称不能为空')
      const project = cleanProject({
        id: newId(),
        name: name.slice(0, 60),
        description: String(body.description || '').trim().slice(0, 500),
        instructions: '',
        memory: '',
        createdAt: Date.now(),
      })
      data.projects.push(project)
      await saveData()
      return project
    },
    async update(body) {
      const data = await loadData()
      const project = data.projects.find((p) => p.id === body.id)
      if (!project) throw new Error('项目不存在')
      if (typeof body.name === 'string' && body.name.trim()) project.name = body.name.trim().slice(0, 60)
      if (typeof body.description === 'string') project.description = body.description.trim().slice(0, 500)
      if (typeof body.instructions === 'string') project.instructions = body.instructions.slice(0, 8000)
      if (typeof body.memory === 'string') project.memory = body.memory.slice(0, 32000)
      if (typeof body.autoBrief === 'boolean') project.autoBrief = body.autoBrief
      await saveData()
      return cleanProject(project)
    },
    async remove(body) {
      const data = await loadData()
      const before = data.projects.length
      data.projects = data.projects.filter((p) => p.id !== body.id)
      const kept = {}
      for (const key of Object.keys(data.assignments)) {
        if (data.assignments[key] !== body.id) kept[key] = data.assignments[key]
      }
      data.assignments = kept
      await saveData()
      return { removed: before - data.projects.length }
    },
    async assign(body) {
      const data = await loadData()
      const sessionId = String(body.sessionId || '')
      if (!sessionId) throw new Error('缺少 sessionId')
      const projectId = body.projectId ?? null
      if (projectId === null || projectId === '') {
        delete data.assignments[sessionId]
      } else {
        const exists = data.projects.some((p) => p.id === projectId)
        if (!exists) throw new Error('项目不存在')
        data.assignments[sessionId] = String(projectId)
      }
      await saveData()
      return { ok: true }
    },
  }

  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/state`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        const data = await loadData()
        writeJson(res, 200, {
          ok: true,
          projects: data.projects.map(cleanProject),
          assignments: { ...data.assignments },
          persistOk: state.persistOk,
          file: DATA_FILE,
        })
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/create`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, await actions.create(await readBody(req)))
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/update`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, await actions.update(await readBody(req)))
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/delete`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, await actions.remove(await readBody(req)))
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/assign`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        writeJson(res, 200, await actions.assign(await readBody(req)))
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/sessions`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        const items = await listSessions(ctx)
        writeJson(res, 200, { ok: true, items })
      }),
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/project-of`,
      handler: guarded(async (req, res) => {
        if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
        const url = new URL(req.url, 'http://localhost')
        const sessionId = url.searchParams.get('sessionId') || ''
        const data = await loadData()
        const pid = data.assignments[sessionId] || null
        const project = pid ? data.projects.find((p) => p.id === pid) || null : null
        writeJson(res, 200, {
          ok: true,
          projectId: project ? project.id : null,
          projectName: project ? project.name : null,
        })
      }),
    },
    // NOTE: new-session creation is done client-side (sessions.create via the
    // browser runtime, then POST /assign) — host-side store.create() without a
    // workspace/preset context produces a phantom id that never materializes.
  ]

  ctx.effect(
    () => {
      const disposers = []
      try {
        for (const route of routes) disposers.push(webServer.register(route))
      } catch (error) {
        for (const dispose of disposers) dispose()
        throw error
      }
      return () => {
        for (const dispose of disposers) dispose()
      }
    },
    'projects-mode: api routes',
  )

  console.log('[projects-mode] host half applied (v0.3); data file: ' + DATA_FILE)
}
