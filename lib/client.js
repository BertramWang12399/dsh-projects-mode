// dsh-projects-mode v0.4 — Browser half (ModuleLoader bundle).
// Sidebar entry row + full-screen project manager view, same DOM technique as
// the task-board / ssh / skill-explorer family (plain DOM + self-healing).
// v0.4: workspace auto-assign field, session filter, dead-assignment cleanup
// button, activity-sorted project list, event-driven badge (no idle polling).

window.__ModuleLoader__.load({
  id: 'dsh-projects-mode',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const API_PREFIX = '/projects-mode/api'
    const CSS = [
      '/* projects-mode shared atoms */',
      '.pm-create { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px dashed var(--dsw-alias-border-l2, rgba(255,255,255,0.18)); border-radius: 10px; }',
      '.pm-input { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.05)); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.1)); color: var(--dsw-alias-label-primary, #fff); border-radius: 8px; padding: 6px 9px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }',
      '.pm-input:focus { border-color: var(--dsw-alias-brand-primary, #4f8cff); }',
      '.pm-btn { background: var(--dsw-alias-brand-primary, #4f8cff); color: #fff; border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }',
      '.pm-btn:hover { filter: brightness(1.1); }',
      '.pm-btn:disabled { opacity: 0.45; cursor: default; }',
      '.pm-ghost { background: transparent; color: var(--dsw-alias-label-secondary, #9a9aa0); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.1)); border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; }',
      '.pm-ghost:hover { color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.07)); }',
      '.pm-danger-armed { border-color: var(--dsw-alias-state-error-primary, #ff5d5d) !important; color: var(--dsw-alias-state-error-primary, #ff5d5d) !important; }',
      '.pm-section-title { font-size: 11px; letter-spacing: 0.06em; color: var(--dsw-alias-label-secondary, #9a9aa0); margin: 2px 0; }',
      '.pm-count { font-size: 11px; color: var(--dsw-alias-label-secondary, #9a9aa0); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.08)); border-radius: 999px; padding: 1px 8px; }',
      '.pm-mini { background: transparent; border: none; cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-secondary, #9a9aa0); padding: 3px 5px; border-radius: 6px; }',
      '.pm-mini:hover { color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.08)); }',
      '.pm-desc { color: var(--dsw-alias-label-secondary, #9a9aa0); font-size: 12px; line-height: 1.45; margin: 0; }',
      '.pm-sess { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; cursor: pointer; }',
      '.pm-sess:hover { background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.06)); }',
      '.pm-sess-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.pm-sess-time { font-size: 11px; color: var(--dsw-alias-label-secondary, #9a9aa0); flex-shrink: 0; }',
      '.pm-addrow { display: flex; gap: 6px; }',
      '.pm-hint { color: var(--dsw-alias-label-secondary, #8a8a90); font-size: 12px; padding: 4px 2px; }',
      '.pm-foot { padding: 8px 14px; border-top: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.07)); font-size: 11px; color: var(--dsw-alias-label-secondary, #8a8a90); display: flex; justify-content: space-between; }',
      '/* sidebar entry row */',
      ".pmx-entry { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 10px; background: transparent; border: none; border-radius: 8px; color: var(--dsw-alias-label-secondary, #9a9aa0); cursor: pointer; font-size: 13px; white-space: nowrap; text-align: left; font-family: inherit; }",
      '.pmx-entry:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.15)); color: var(--dsw-alias-label-primary, #fff); }',
      '.pmx-entry[data-active] { background: var(--dsw-alias-interactive-bg-active, rgba(127,127,127,0.25)); color: var(--dsw-alias-label-primary, #fff); font-weight: 600; }',
      '.pmx-entry-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none; }',
      '.pmx-entry-icon svg { display: block; width: 18px; height: 18px; }',
      '.pmx-entry-label { overflow: hidden; text-overflow: ellipsis; }',
      '[data-dsh-frame][data-sidebar-collapsed] .pmx-entry { justify-content: center; padding: 0; width: 36px; height: 36px; margin: 0 auto 12px; border-radius: 50%; }',
      '[data-dsh-frame][data-sidebar-collapsed] .pmx-entry-label { display: none; }',
      '/* center takeover view */',
      "[data-pane='conversation'], [class*='centerCol'] { position: relative; }",
      '[data-dsh-projects-view] { position: absolute; inset: 0; display: none; z-index: 60; background: var(--dsw-alias-bg-base, #16161a); color: var(--dsw-alias-label-primary, #f5f5f7); box-sizing: border-box; overflow: hidden; }',
      "html[data-dsh-projects-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-projects-view] { display: block; }",
      "html[data-dsh-projects-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane='conversation'] > :not([data-dsh-projects-view]),",
      "html[data-dsh-projects-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*='centerCol'] > :not([data-dsh-projects-view]) { display: none !important; }",
      '.pmx-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; padding: 18px 22px; gap: 12px; box-sizing: border-box; overflow: hidden; }',
      '.pmx-topbar { display: flex; align-items: center; gap: 10px; flex: none; }',
      '.pmx-bigtitle { font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex: 1; margin: 0; }',
      '.pmx-cols { display: flex; gap: 16px; flex: 1; min-height: 0; }',
      '.pmx-left { width: 280px; flex: none; display: flex; flex-direction: column; gap: 8px; min-height: 0; }',
      ".pmx-right { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; border-left: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.18)); padding-left: 16px; }",
      '.pmx-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; min-height: 0; }',
      '.pmx-pitem { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.2)); border-radius: 10px; padding: 9px 11px; cursor: pointer; display: flex; align-items: center; gap: 8px; }',
      '.pmx-pitem:hover { background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08)); }',
      '.pmx-pitem.sel { border-color: var(--dsw-alias-brand-primary, #4f8cff); background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08)); }',
      '.pmx-renamebox { display: flex; flex-direction: column; gap: 6px; width: 100%; }',
      '/* session badge */',
      '.pmx-badge { position: absolute; top: 10px; right: 14px; z-index: 70; display: inline-flex; align-items: center; gap: 4px; background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.12)); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3)); color: var(--dsw-alias-label-secondary, #b9b9bf); border-radius: 999px; padding: 3px 10px; font-size: 11px; cursor: pointer; font-family: inherit; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: auto; }',
      '.pmx-badge:hover { color: var(--dsw-alias-label-primary, #fff); border-color: var(--dsw-alias-brand-primary, #4f8cff); }',
      ".pmx-badge-menu { position: absolute; top: 40px; right: 14px; z-index: 71; min-width: 200px; max-width: 280px; max-height: 320px; overflow-y: auto; background: var(--dsw-alias-bg-overlay, #1c1c1e); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.12)); border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,0.45); padding: 10px 12px; display: none; color: var(--dsw-alias-label-primary, #f5f5f7); font-size: 13px; pointer-events: auto; }",
      '/* token meters */',
      '.pm-tokens { font-size: 11px; color: var(--dsw-alias-label-secondary, #9a9aa0); display: flex; justify-content: flex-end; align-items: center; }',
      '.pm-tokens .warn { color: var(--dsw-alias-state-warning-primary, #ef9f27); }',
      '.pm-tokens .over { color: var(--dsw-alias-state-error-primary, #ff5d5d); }',
      '.pm-briefrow { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--dsw-alias-label-secondary, #9a9aa0); cursor: pointer; user-select: none; }',
      '.pm-briefrow input { accent-color: var(--dsw-alias-brand-primary, #4f8cff); margin: 0; }',
    ].join('\n')

    function api(method, args) {
      const isGet = method === 'state' || method === 'sessions'
      const init = isGet
        ? {}
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args || {}) }
      return fetch(API_PREFIX + '/' + method, init).then(async (res) => {
        let body = {}
        try {
          body = await res.json()
        } catch (e) {
          body = {}
        }
        if (!res.ok) throw new Error((body && body.error) || 'HTTP ' + res.status)
        return body
      })
    }

    function fmtTime(ts) {
      if (!ts || typeof ts !== 'number') return ''
      const diff = Date.now() - ts
      if (diff >= 0 && diff < 60000) return '刚刚'
      if (diff >= 0 && diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + ' 分钟前'
      if (diff >= 0 && diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
      try {
        const dd = new Date(ts)
        const pad = function (n) {
          return (n < 10 ? '0' : '') + n
        }
        return dd.getFullYear() + '-' + pad(dd.getMonth() + 1) + '-' + pad(dd.getDate())
      } catch (e) {
        return ''
      }
    }

    /**
     * Required services: sessions for open/list, workspaces for the
     * New-Session flow (startSession). sessions has NO create method —
     * the only supported creation path is workspaces.startSession().
     */
    const inject = ['sessions', 'workspaces']

    /**
     * Rough token estimate for mixed CJK/Latin text: ~0.6 tokens per CJK
     * char, ~0.25 per Latin char. Good enough for a budget display (±20%).
     */
    function estTokens(text) {
      const t = String(text || '')
      let cjk = 0
      for (let i = 0; i < t.length; i++) {
        if (t.charCodeAt(i) > 0x2e00) cjk++
      }
      return Math.round(cjk * 0.6 + (t.length - cjk) * 0.25)
    }

    /**
     * Mount the sidebar entry and the takeover view.
     * @param ctx - client root context (services: sessions).
     */
    function apply(ctx) {
      const d = document
      const ROW_ATTR = 'data-dsh-projects-entry'
      const SEL = '[' + ROW_ATTR + ']'

      if (d.querySelector('style[data-projects-mode-css]') === null) {
        const tag = d.createElement('style')
        tag.setAttribute('data-projects-mode-css', '')
        tag.textContent = CSS
        d.head.appendChild(tag)
      }

      /** Transient toast in the conversation pane — visible error/feedback. */
      let toastTimer = null
      function toast(msg, ok) {
        try {
          const pane = d.querySelector("[data-pane='conversation'], [class*='centerCol']")
          if (pane === null) return
          let el = pane.querySelector('[data-projects-mode-toast]')
          if (el === null) {
            el = d.createElement('div')
            el.setAttribute('data-projects-mode-toast', '')
            el.style.cssText =
              'position:absolute;top:40px;left:50%;transform:translateX(-50%);z-index:80;max-width:60%;' +
              'background:var(--dsw-alias-bg-overlay,#1c1c1e);color:var(--dsw-alias-label-primary,#f5f5f7);' +
              'border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.3));border-radius:10px;' +
              'padding:8px 14px;font-size:12px;pointer-events:none;box-shadow:0 12px 32px rgba(0,0,0,0.35);'
            pane.appendChild(el)
          }
          el.style.borderColor = ok
            ? 'var(--dsw-alias-state-success-primary,#4cd47c)'
            : 'var(--dsw-alias-state-error-primary,#ff5d5d)'
          el.textContent = msg
          el.style.display = 'block'
          if (toastTimer !== null) clearTimeout(toastTimer)
          toastTimer = window.setTimeout(function () {
            el.style.display = 'none'
            toastTimer = null
          }, 4000)
        } catch (e) {
          /* toast is best-effort */
        }
      }

      let domOpen = false
      const openSubs = new Set()
      function setOpen(v) {
        v = !!v
        if (v === domOpen) return
        domOpen = v
        try {
          if (v) d.documentElement.setAttribute('data-dsh-projects-active', '')
          else d.documentElement.removeAttribute('data-dsh-projects-active')
        } catch (e) {}
        openSubs.forEach(function (fn) {
          try {
            fn(domOpen)
          } catch (e) {
            console.error('[projects-mode] open listener failed:', e)
          }
        })
      }
      const openApi = {
        get: function () {
          return domOpen
        },
        set: setOpen,
        subscribe: function (fn) {
          openSubs.add(fn)
          return function () {
            openSubs.delete(fn)
          }
        },
      }

      /**
       * Central assignment mutation: every UI path funnels through here so
       * the session badge can refresh event-driven instead of polling the
       * /project-of endpoint on a timer.
       */
      const assignSubs = new Set()
      function notifyAssigned(sessionId) {
        assignSubs.forEach(function (fn) {
          try {
            fn(sessionId)
          } catch (e) {
            /* listener errors must not break the assign flow */
          }
        })
      }
      function assignSession(sessionId, projectId) {
        return api('assign', { sessionId: sessionId, projectId: projectId }).then(function (r) {
          notifyAssigned(sessionId)
          return r
        })
      }

      const escHandler = function (e) {
        if ((e.key === 'Escape' || e.key === 'Esc') && openApi.get()) {
          e.stopPropagation()
          setOpen(false)
        }
      }
      // Registered only inside ctx.effect below — a standalone registration
      // here would leak one listener per hot-reload (removeEventListener in
      // the disposer runs once, but the listener was added twice).

      const entryDisposer = injectEntry()
      const viewDisposer = mountView()
      const statusDisposer = suppressCordisStatus()
      const badgeDisposer = mountBadge()

      ctx.effect(
        () => {
          d.addEventListener('keydown', escHandler, true)
          return () => {
            d.removeEventListener('keydown', escHandler, true)
            entryDisposer()
            viewDisposer()
            statusDisposer()
            if (badgeDisposer) badgeDisposer()
            try {
              d.documentElement.removeAttribute('data-dsh-projects-active')
            } catch (e) {}
          }
        },
        'projects-mode: dom integration',
      )

      function injectEntry() {
        const ICON =
          '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.3c0-.7.6-1.3 1.3-1.3h2.9l1.5 1.6h4.9c.8 0 1.4.6 1.4 1.4v6c0 .8-.6 1.4-1.4 1.4H3.4c-.8 0-1.4-.6-1.4-1.4V4.3z"/><path d="M2 6.8h12"/></svg>'
        const entry = d.createElement('button')
        entry.type = 'button'
        entry.setAttribute(ROW_ATTR, '')
        entry.className = 'pmx-entry'
        entry.setAttribute('aria-label', '项目')
        entry.setAttribute('title', '项目模式：按项目组织会话')
        entry.innerHTML = '<span class="pmx-entry-icon">' + ICON + '</span><span class="pmx-entry-label">项目</span>'
        entry.addEventListener('click', function () {
          setOpen(!openApi.get())
        })
        function syncActive() {
          try {
            if (openApi.get()) entry.dataset.active = 'true'
            else delete entry.dataset.active
          } catch (e) {}
        }
        openApi.subscribe(syncActive)
        syncActive()

        function sidebarRoot() {
          const col = d.querySelector("[data-pane='sidebar'], [class*='sidebarCol']")
          if (col === null) return undefined
          const logoOwner = col.querySelector('[class*="logoRow"]')
          return (logoOwner && logoOwner.parentElement) || col.firstElementChild || undefined
        }
        function newSessionButton(root) {
          const nested = root.querySelector('button[class*="newSession"]')
          if (nested !== null) return nested
          const kids = root.children
          for (let i = 0; i < kids.length; i++) {
            if (kids[i].tagName === 'BUTTON') return kids[i]
          }
          return undefined
        }
        const FAMILY = [SEL, '[data-dsh-taskboard-entry]', '[data-dsh-ssh-entry]', '[data-dsh-skill-explorer-entry]']
        function place(root) {
          const btn = newSessionButton(root)
          if (btn === undefined) return false
          if (entry.parentElement !== root) {
            const row = btn.closest('[class*="logoRow"]')
            const base = row !== null && row.parentElement === root ? row : btn
            const fam = []
            const kids = root.children
            for (let i = 0; i < kids.length; i++) {
              const el = kids[i]
              let m = false
              try {
                m = el.matches(FAMILY.join(', '))
              } catch (e) {
                m = false
              }
              if (m) fam.push(el)
            }
            const anchor = fam.length > 0 ? fam[fam.length - 1].nextSibling : base.nextSibling
            root.insertBefore(entry, anchor)
          }
          return true
        }

        let root
        let placed = false
        const rootObs = new MutationObserver(function () {
          if (root === undefined || !root.isConnected) {
            placed = false
            tryPlace()
            return
          }
          if (!root.contains(entry)) placed = place(root)
        })
        function tryPlace() {
          if (root !== undefined && !root.isConnected) {
            rootObs.disconnect()
            root = undefined
            placed = false
          }
          if (placed) {
            if (d.body.contains(entry)) return
            rootObs.disconnect()
            root = undefined
            placed = false
          }
          if (root === undefined) root = sidebarRoot()
          if (root === undefined) return
          placed = place(root)
          if (placed) rootObs.observe(root, { childList: true, subtree: true })
        }
        const waitObs = new MutationObserver(function () {
          tryPlace()
        })
        waitObs.observe(d.body, { childList: true, subtree: true })
        tryPlace()

        return function () {
          waitObs.disconnect()
          rootObs.disconnect()
          entry.remove()
        }
      }

      function suppressCordisStatus() {
        const hiddenNodes = new Set()
        function sweep() {
          const col = d.querySelector("[data-pane='sidebar'], [class*='sidebarCol']")
          if (col === null) return
          const labels = col.querySelectorAll('span, div, p')
          for (let i = 0; i < labels.length; i++) {
            const el = labels[i]
            if (hiddenNodes.has(el)) continue
            const raw = el.textContent || ''
            const t = raw.replace(/\s+/g, ' ').trim()
            if (t !== 'Cordis Plugin') continue
            let node = el
            while (node.parentElement && node.parentElement !== col) {
              const ptRaw = node.parentElement.textContent || ''
              const pt = ptRaw.replace(/\s+/g, ' ').trim()
              if (pt.length > 60) break
              node = node.parentElement
            }
            if (node === col) continue
            try {
              node.style.setProperty('display', 'none', 'important')
              hiddenNodes.add(node)
            } catch (e) {}
          }
        }
        const obs = new MutationObserver(function () {
          sweep()
        })
        obs.observe(d.body, { childList: true, subtree: true })
        sweep()
        return function () {
          obs.disconnect()
          hiddenNodes.forEach(function (n) {
            try {
              n.style.removeProperty('display')
            } catch (e) {}
          })
        }
      }

      function mountView() {
        const model = { projects: [], assignments: {}, sessions: [], selected: null }
        let renamingId = null
        const view = d.createElement('div')
        view.className = 'pmx-root'
        view.setAttribute('data-dsh-projects-view', '')
        let els = null

        function attach() {
          if (view.isConnected) return true
          const pane = d.querySelector("[data-pane='conversation'], [class*='centerCol']")
          if (pane === null) return false
          pane.appendChild(view)
          buildSkeleton()
          renderAll()
          return true
        }

        function h(tag, cls, text) {
          const el = d.createElement(tag)
          if (cls) el.className = cls
          if (text !== undefined && text !== null) el.textContent = text
          return el
        }
        function clear(node) {
          while (node.firstChild) node.removeChild(node.firstChild)
        }

        function buildSkeleton() {
          if (els) return
          const wrap = h('div', 'pmx-wrap')
          const topbar = h('div', 'pmx-topbar')
          const title = h('p', 'pmx-bigtitle')
          title.appendChild(h('span', null, '📁'))
          title.appendChild(h('span', null, '项目'))
          const refreshBtn = h('button', 'pm-ghost', '↻ 刷新')
          refreshBtn.addEventListener('click', function () {
            refresh()
          })
          const closeBtn = h('button', 'pm-ghost', '✕ 关闭 (Esc)')
          closeBtn.addEventListener('click', function () {
            setOpen(false)
          })
          topbar.appendChild(title)
          topbar.appendChild(refreshBtn)
          topbar.appendChild(closeBtn)

          const cols = h('div', 'pmx-cols')
          const left = h('div', 'pmx-left')
          left.appendChild(h('div', 'pm-section-title', '项目列表'))
          const projectList = h('div', 'pmx-list')
          projectList.addEventListener('click', function (e) {
            const target = e.target
            if (target && target.closest && target.closest('button')) return
            const item = target && target.closest ? target.closest('[data-pid]') : null
            if (!item) return
            const pid = item.getAttribute('data-pid')
            if (renamingId === pid) return
            model.selected = pid
            renderAll()
          })
          const createBox = h('div', 'pm-create')
          const nameInput = h('input', 'pm-input')
          nameInput.placeholder = '新项目名称…'
          const descInput = h('input', 'pm-input')
          descInput.placeholder = '简介（可选）'
          const createBtn = h('button', 'pm-btn', '+ 创建项目')
          createBtn.style.alignSelf = 'flex-end'
          createBtn.addEventListener('click', function () {
            const name = nameInput.value.trim()
            if (!name) return
            createBtn.disabled = true
            createBtn.textContent = '创建中…'
            api('create', { name: name, description: descInput.value })
              .then(function (p) {
                nameInput.value = ''
                descInput.value = ''
                createBtn.textContent = '+ 创建项目'
                if (p && p.id) model.selected = p.id
                renamingId = null
                return refresh()
              })
              .catch(function (e) {
                console.error('[projects-mode]', e)
                createBtn.textContent = '创建失败，请重试'
                window.setTimeout(function () {
                  createBtn.textContent = '+ 创建项目'
                }, 2600)
              })
              .then(function () {
                createBtn.disabled = false
              })
          })
          createBox.appendChild(nameInput)
          createBox.appendChild(descInput)
          createBox.appendChild(createBtn)
          left.appendChild(projectList)
          left.appendChild(createBox)

          const right = h('div', 'pmx-right')
          const detailHead = h('div', 'pm-addrow')
          detailHead.style.justifyContent = 'space-between'
          const detailTitle = h('p', 'pmx-bigtitle')
          const headBtns = h('div', 'pm-addrow')
          const newSessBtn = h('button', 'pm-ghost', '✨ 新建会话')
          newSessBtn.disabled = true
          newSessBtn.title = '创建一个新会话并立即归入此项目'
          newSessBtn.addEventListener('click', function () {
            if (!model.selected) return
            const pid = model.selected
            newSessBtn.disabled = true
            const workspaces = ctx.get('workspaces')
            const svc = ctx.get('sessions')
            if (!workspaces || typeof workspaces.startSession !== 'function') {
              toast('新建会话失败：当前 DSH 未提供 workspaces 服务（检查插件 inject 声明）', false)
              newSessBtn.disabled = false
              return
            }
            /** Current session id from the client-side snapshot (badge uses the same). */
            function currentSnapshotId() {
              try {
                const snap = svc && svc.list && typeof svc.list.getSnapshot === 'function' ? svc.list.getSnapshot() : null
                return snap && snap.current ? String(snap.current) : ''
              } catch (e) {
                return ''
              }
            }
            // 1) Primary detection: startSession switches the current session —
            //    watch the snapshot's `current` flip to the new id (fast, offline).
            const beforeCurrent = currentSnapshotId()
            // 2) Fallback: diff the host corpus (works if the snapshot lags).
            const before = {}
            model.sessions.forEach(function (s) {
              before[s.id] = true
            })
            let started = false
            try {
              workspaces.startSession(undefined)
              started = true
            } catch (e) {
              console.error('[projects-mode] startSession threw:', e)
            }
            if (!started) {
              toast('新建会话失败：startSession 调用出错，详情见浏览器控制台', false)
              newSessBtn.disabled = false
              return
            }
            function pollSnapshot(deadline) {
              const id = currentSnapshotId()
              if (id && id !== beforeCurrent) return Promise.resolve(id)
              if (Date.now() > deadline) return Promise.resolve('')
              return new Promise(function (resolve) {
                window.setTimeout(resolve, 250)
              }).then(function () {
                return pollSnapshot(deadline)
              })
            }
            pollSnapshot(Date.now() + 5000)
              .then(function (sid) {
                return sid || pollForNew(before, Date.now() + 4000)
              })
              .then(function (sid) {
                if (!sid) return null
                return assignSession(sid, pid).then(function () {
                  return sid
                })
              })
              .then(function (sid) {
                const pname = (model.projects.find(function (p) { return p.id === pid }) || {}).name || ''
                if (!sid) {
                  toast('⚠ 本次新建的是普通会话（未归入项目）。可点右上角「📁 未归类」徽标手动选择归属，或在项目页用下拉加入', false)
                } else {
                  toast('✓ 新会话已创建并归入项目「' + pname + '」——右上角徽标可随时查看/切换归属', true)
                  openSession(sid)
                  return refresh()
                }
              })
              .catch(function (e) {
                console.error('[projects-mode] new session flow failed:', e)
                toast('新建会话失败：' + ((e && e.message) ? e.message : String(e)), false)
              })
              .then(function () {
                newSessBtn.disabled = false
              })
          })

          function pollForNew(before, deadline) {
            return api('sessions').then(function (r) {
              const items = Array.isArray(r.items) ? r.items : []
              for (let i = 0; i < items.length; i++) {
                if (!before[items[i].id]) return items[i].id
              }
              if (Date.now() > deadline) return null
              return new Promise(function (resolve) {
                window.setTimeout(resolve, 400)
              }).then(function () {
                return pollForNew(before, deadline)
              })
            })
          }
          const openLatestBtn = h('button', 'pm-ghost', '⏩ 打开最近会话')
          openLatestBtn.disabled = true
          openLatestBtn.addEventListener('click', function () {
            const mine = model.sessions.filter(function (s) {
              return s.projectId === model.selected
            })
            if (mine.length === 0) return
            openSession(mine[0].id)
          })
          headBtns.appendChild(newSessBtn)
          headBtns.appendChild(openLatestBtn)
          detailHead.appendChild(detailTitle)
          detailHead.appendChild(headBtns)
          const detailDesc = h('div', 'pm-desc')

          // Instructions + memory editors (live injection: instructions render
          // into the system prompt at every assembly; memory block refreshes in
          // place on the next step after each save). v0.3: token meters and
          // the auto-briefing toggle (the token-saving handoff).
          const editBox = h('div', 'pm-create')
          editBox.style.display = 'none'
          const instrArea = h('textarea', 'pm-input')
          instrArea.rows = 4
          instrArea.placeholder = '项目指令（注入本项目所有会话的系统提示，实时生效）…'
          instrArea.style.resize = 'vertical'
          const instrTokens = h('div', 'pm-tokens')
          const memArea = h('textarea', 'pm-input')
          memArea.rows = 4
          memArea.placeholder = '项目记忆（跨会话共享，保存后下一步自动刷新到模型）…'
          memArea.style.resize = 'vertical'
          const memTokens = h('div', 'pm-tokens')
          const wsInput = h('input', 'pm-input')
          wsInput.placeholder = '工作目录（可选）：该目录下的会话自动归入本项目，如 /Users/you/WorkBuddy'
          function paintTokens(el, text) {
            while (el.firstChild) el.removeChild(el.firstChild)
            const n = estTokens(text)
            const label = h('span', null, '约 ' + n.toLocaleString() + ' tokens')
            if (n > 4000) label.className = 'over'
            else if (n > 1500) label.className = 'warn'
            el.appendChild(label)
            if (n > 4000) el.appendChild(h('span', null, '偏大，建议精简'))
            else if (n > 1500) el.appendChild(h('span', null, '注意上下文开销'))
          }
          instrArea.addEventListener('input', function () {
            paintTokens(instrTokens, instrArea.value)
          })
          memArea.addEventListener('input', function () {
            paintTokens(memTokens, memArea.value)
          })
          const briefRow = h('label', 'pm-briefrow')
          const briefChk = d.createElement('input')
          briefChk.type = 'checkbox'
          briefChk.checked = true
          briefRow.appendChild(briefChk)
          briefRow.appendChild(h('span', null, '新会话自动携带项目简报（自动总结本项目近期工作，比拖长老会话省 token）'))
          const editRow = h('div', 'pm-addrow')
          editRow.style.alignItems = 'center'
          const saveEditBtn = h('button', 'pm-btn', '保存指令与记忆')
          saveEditBtn.disabled = true
          const saveFeedback = h('span', 'pm-hint', '')
          saveFeedback.style.marginRight = 'auto'
          let saveFeedbackTimer = null
          function showSaveFeedback(text, ok) {
            saveFeedback.textContent = text
            saveFeedback.style.color = ok
              ? 'var(--dsw-alias-state-success-primary, #4cd47c)'
              : 'var(--dsw-alias-state-error-primary, #ff7b7b)'
            if (saveFeedbackTimer !== null) clearTimeout(saveFeedbackTimer)
            saveFeedbackTimer = window.setTimeout(function () {
              saveFeedback.textContent = ''
              saveFeedbackTimer = null
            }, 2600)
          }
          editRow.appendChild(saveFeedback)
          editRow.appendChild(saveEditBtn)
          editBox.appendChild(instrArea)
          editBox.appendChild(instrTokens)
          editBox.appendChild(memArea)
          editBox.appendChild(memTokens)
          editBox.appendChild(wsInput)
          editBox.appendChild(briefRow)
          editBox.appendChild(editRow)

          const toggleEditBtn = h('button', 'pm-ghost', '✎ 指令 / 记忆')
          toggleEditBtn.disabled = true
          toggleEditBtn.addEventListener('click', function () {
            const sel =
              model.projects.find(function (p) {
                return p.id === model.selected
              }) || null
            if (!sel) return
            if (editBox.style.display === 'none') {
              instrArea.value = sel.instructions || ''
              memArea.value = sel.memory || ''
              wsInput.value = sel.workspace || ''
              briefChk.checked = sel.autoBrief !== false
              paintTokens(instrTokens, instrArea.value)
              paintTokens(memTokens, memArea.value)
              saveEditBtn.disabled = false
              editBox.style.display = 'flex'
              toggleEditBtn.textContent = '收起编辑'
            } else {
              editBox.style.display = 'none'
              toggleEditBtn.textContent = '✎ 指令 / 记忆'
            }
          })
          saveEditBtn.addEventListener('click', function () {
            if (!model.selected) return
            saveEditBtn.disabled = true
            saveFeedback.textContent = '保存中…'
            saveFeedback.style.color = ''
            api('update', {
              id: model.selected,
              instructions: instrArea.value,
              memory: memArea.value,
              workspace: wsInput.value,
              autoBrief: briefChk.checked,
            })
              .then(function () {
                showSaveFeedback('✓ 已保存，指令与记忆已对本项目会话生效', true)
                return refresh()
              })
              .catch(function (e) {
                console.error('[projects-mode]', e)
                showSaveFeedback('✗ 保存失败：' + ((e && e.message) ? e.message : String(e)), false)
              })
              .then(function () {
                saveEditBtn.disabled = false
              })
          })

          const sessList = h('div', 'pmx-list')
          const toolbar = h('div', 'pm-addrow')
          toolbar.style.alignItems = 'center'
          const sessFilter = h('input', 'pm-input')
          sessFilter.placeholder = '🔎 过滤会话标题…'
          sessFilter.addEventListener('input', function () {
            renderSessions()
          })
          const cleanupBtn = h('button', 'pm-ghost', '🧹 清理失效归属')
          cleanupBtn.title = '移除指向已删除会话的归属记录（也可在启动时自动执行）'
          cleanupBtn.addEventListener('click', function () {
            cleanupBtn.disabled = true
            api('cleanup', {})
              .then(function (r) {
                toast('清理完成：移除 ' + ((r && r.dropped) || 0) + ' 条失效归属', true)
                return refresh()
              })
              .catch(function (e) {
                console.error('[projects-mode]', e)
                toast('清理失败：' + ((e && e.message) ? e.message : String(e)), false)
              })
              .then(function () {
                cleanupBtn.disabled = false
              })
          })
          toolbar.appendChild(sessFilter)
          toolbar.appendChild(cleanupBtn)
          const addRow = h('div', 'pm-addrow')
          addRow.style.maxWidth = '520px'
          const pickSel = h('select', 'pm-input')
          const addBtn = h('button', 'pm-ghost', '➕ 加入此项目')
          addBtn.disabled = true
          addBtn.addEventListener('click', function () {
            if (!model.selected || !pickSel.value) return
            assignSession(pickSel.value, model.selected)
              .then(function () {
                return refresh()
              })
              .catch(function (e) {
                console.error('[projects-mode]', e)
              })
          })
          addRow.appendChild(pickSel)
          addRow.appendChild(addBtn)
          right.appendChild(detailHead)
          right.appendChild(detailDesc)
          right.appendChild(toggleEditBtn)
          right.appendChild(editBox)
          right.appendChild(toolbar)
          right.appendChild(sessList)
          right.appendChild(addRow)

          cols.appendChild(left)
          cols.appendChild(right)
          wrap.appendChild(topbar)
          wrap.appendChild(cols)
          const foot = h('div', 'pm-foot')
          foot.appendChild(h('span', null, '数据保存在 ~/.dsh/.dsh-projects.json · 点击会话行直接打开 · Esc 关闭'))
          foot.appendChild(h('span', null, 'v0.4.0 · 工作目录自动归属 + 项目简报免拖老会话'))
          wrap.appendChild(foot)
          view.appendChild(wrap)
          els = {
            projectList: projectList,
            detailTitle: detailTitle,
            detailDesc: detailDesc,
            sessList: sessList,
            pickSel: pickSel,
            addBtn: addBtn,
            openLatestBtn: openLatestBtn,
            newSessBtn: newSessBtn,
            toggleEditBtn: toggleEditBtn,
            sessFilter: sessFilter,
            cleanupBtn: cleanupBtn,
          }
          pickSel.addEventListener('change', function () {
            els.addBtn.disabled = !(model.selected && els.pickSel.value)
          })
        }

        function openSession(id) {
          const svc = ctx.get('sessions')
          if (svc && typeof svc.open === 'function') {
            svc.open(id)
            setOpen(false)
          }
        }

        function buildRenameBox(p) {
          const box = h('div', 'pmx-renamebox')
          const input = h('input', 'pm-input')
          input.value = p.name
          const row = h('div', 'pm-addrow')
          const ok = h('button', 'pm-btn', '✓')
          const cancel = h('button', 'pm-ghost', '✕')
          ok.addEventListener('click', function (e) {
            e.stopPropagation()
            const name = input.value.trim()
            if (!name) return
            api('update', { id: p.id, name: name })
              .then(function () {
                renamingId = null
                return refresh()
              })
              .catch(function (err) {
                console.error('[projects-mode]', err)
              })
          })
          cancel.addEventListener('click', function (e) {
            e.stopPropagation()
            renamingId = null
            renderProjects()
          })
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') ok.click()
            else if (e.key === 'Escape') cancel.click()
          })
          row.appendChild(ok)
          row.appendChild(cancel)
          box.appendChild(input)
          box.appendChild(row)
          return box
        }

        function projectLatest(pid) {
          let latest = 0
          model.sessions.forEach(function (s) {
            if (s.projectId === pid && s.updatedAt > latest) latest = s.updatedAt
          })
          return latest
        }

        function renderProjects() {
          if (!els) return
          clear(els.projectList)
          // Most recently active project first; untouched projects keep
          // creation order at the bottom (stable sort).
          const ordered = model.projects
            .map(function (p, i) {
              return { p: p, i: i, latest: projectLatest(p.id) }
            })
            .sort(function (a, b) {
              return b.latest - a.latest || a.i - b.i
            })
          ordered.forEach(function (entry) {
            const p = entry.p
            const count = model.sessions.filter(function (s) {
              return s.projectId === p.id
            }).length
            const item = h('div', 'pmx-pitem' + (model.selected === p.id ? ' sel' : ''))
            item.setAttribute('data-pid', p.id)
            if (renamingId === p.id) {
              item.style.display = 'block'
              item.appendChild(buildRenameBox(p))
              els.projectList.appendChild(item)
              Promise.resolve().then(function () {
                const inputEl = item.querySelector('input')
                if (inputEl) inputEl.focus()
              })
              return
            }
            const name = h('div', 'pm-pname', p.name)
            name.style.flex = '1'
            const latest = projectLatest(p.id)
            const timeEl = h('span', 'pm-sess-time', latest ? fmtTime(latest) : '')
            const badge = h('span', 'pm-count', String(count))
            const ren = h('button', 'pm-mini', '✎')
            ren.title = '重命名'
            ren.addEventListener('click', function (e) {
              e.stopPropagation()
              renamingId = p.id
              renderProjects()
            })
            const del = h('button', 'pm-mini', '🗑')
            del.title = '删除（点两次确认）'
            del.addEventListener('click', function (e) {
              e.stopPropagation()
              if (del.getAttribute('data-armed') !== '1') {
                del.setAttribute('data-armed', '1')
                del.classList.add('pm-danger-armed')
                del.textContent = '确认删除?'
                return
              }
              api('delete', { id: p.id })
                .then(function () {
                  if (model.selected === p.id) model.selected = null
                  if (renamingId === p.id) renamingId = null
                  return refresh()
                })
                .catch(function (err) {
                  console.error('[projects-mode]', err)
                })
            })
            item.appendChild(name)
            item.appendChild(timeEl)
            item.appendChild(badge)
            item.appendChild(ren)
            item.appendChild(del)
            els.projectList.appendChild(item)
          })
          if (model.projects.length === 0) {
            els.projectList.appendChild(h('div', 'pm-hint', '还没有项目，用下方表单创建一个。'))
          }
        }

        function renderDetail() {
          if (!els) return
          clear(els.detailTitle)
          const sel = model.projects.find(function (p) {
            return p.id === model.selected
          }) || null
          if (sel) {
            els.detailTitle.appendChild(h('span', null, '📁 ' + sel.name))
            const cnt = model.sessions.filter(function (s) {
              return s.projectId === sel.id
            }).length
            els.detailTitle.appendChild(h('span', 'pm-count', cnt + ' 个会话'))
            const flags = []
            if ((sel.instructions || '').trim()) flags.push('指令 ✓')
            if ((sel.memory || '').trim()) flags.push('记忆 ✓')
            if (sel.autoBrief !== false) flags.push('简报 ✓')
            if ((sel.workspace || '').trim()) flags.push('自动归属 ✓ ' + sel.workspace)
            const ctxCost =
              estTokens(sel.instructions) +
              estTokens(sel.memory) +
              (sel.autoBrief !== false ? 400 : 0)
            flags.push('每步上下文 ≈ ' + ctxCost.toLocaleString() + ' tokens')
            els.detailDesc.textContent =
              (sel.description || '（无简介）') + (flags.length ? ' · ' + flags.join(' · ') : '')
          } else {
            els.detailTitle.appendChild(h('span', null, '未选择项目'))
            els.detailDesc.textContent = '在左侧选择或创建一个项目；下方下拉可把未分配会话加入选中项目。'
          }
        }

        function renderSessions() {
          if (!els) return
          clear(els.sessList)
          clear(els.pickSel)
          const q = (els.sessFilter.value || '').trim().toLowerCase()
          const matches = function (s) {
            return !q || String(s.title || '').toLowerCase().indexOf(q) !== -1
          }
          const selOpt = h('option')
          selOpt.value = ''
          selOpt.textContent = model.sessions.some(function (s) {
            return !s.projectId
          })
            ? '选择未分配的会话…'
            : '没有未分配的会话'
          els.pickSel.appendChild(selOpt)
          model.sessions.forEach(function (s) {
            if (s.projectId) return
            if (!matches(s)) return
            const o = h('option')
            o.value = s.id
            o.textContent = s.title
            els.pickSel.appendChild(o)
          })
          const sel =
            model.projects.find(function (p) {
              return p.id === model.selected
            }) || null
          const mine = sel
            ? model.sessions.filter(function (s) {
                return s.projectId === sel.id && matches(s)
              })
            : []
          els.openLatestBtn.disabled = mine.length === 0
          els.newSessBtn.disabled = !sel
          els.toggleEditBtn.disabled = !sel
          if (!sel) {
            els.sessList.appendChild(h('div', 'pm-hint', '最近会话（最多 200 条）可通过上方下拉加入选中的项目。'))
            els.addBtn.disabled = true
            return
          }
          if (mine.length === 0) {
            els.sessList.appendChild(h('div', 'pm-hint', '此项目还没有会话，从上方下拉选择加入。'))
          }
          mine.forEach(function (s) {
            const rowEl = h('div', 'pm-sess')
            rowEl.setAttribute('data-sid', s.id)
            rowEl.appendChild(h('span', 'pm-sess-title', s.title))
            rowEl.appendChild(h('span', 'pm-sess-time', fmtTime(s.updatedAt)))
            const rm = h('button', 'pm-mini', '➖')
            rm.title = '移出项目'
            rm.addEventListener('click', function (e) {
              e.stopPropagation()
              assignSession(s.id, null)
                .then(function () {
                  return refresh()
                })
                .catch(function (err) {
                  console.error('[projects-mode]', err)
                })
            })
            rowEl.appendChild(rm)
            rowEl.addEventListener('click', function () {
              openSession(s.id)
            })
            els.sessList.appendChild(rowEl)
          })
          els.addBtn.disabled = !els.pickSel.value || !sel
        }

        function renderAll() {
          renderProjects()
          renderDetail()
          renderSessions()
        }

        function refresh() {
          Promise.all([api('state'), api('sessions')])
            .then(function (rs) {
              const list = rs[0] || {}
              const sess = rs[1] || {}
              model.projects = Array.isArray(list.projects) ? list.projects : []
              model.assignments =
                list.assignments && typeof list.assignments === 'object' ? list.assignments : {}
              model.sessions = Array.isArray(sess.items) ? sess.items : []
              if (model.selected && !model.projects.some(function (p) {
                return p.id === model.selected
              })) model.selected = null
              if (renamingId && !model.projects.some(function (p) {
                return p.id === renamingId
              })) renamingId = null
              renderAll()
            })
            .catch(function (e) {
              console.error('[projects-mode] refresh failed:', e)
            })
        }

        openApi.subscribe(function (open) {
          if (open) {
            attach()
            refresh()
          }
        })

        return function () {
          try {
            view.remove()
          } catch (e) {}
        }
      }

      /**
       * Session badge: a floating chip at the top-right of the conversation
       * pane showing the current session's project. Click opens a picker to
       * reassign/remove. Nobody else in the ecosystem has this.
       */
      function mountBadge() {
        const BADGE_ATTR = 'data-projects-mode-badge'
        const chip = d.createElement('button')
        chip.type = 'button'
        chip.setAttribute(BADGE_ATTR, '')
        chip.className = 'pmx-badge'
        chip.style.display = 'none'
        const menu = d.createElement('div')
        menu.className = 'pmx-badge-menu'
        menu.style.display = 'none'

        let currentSessionId = ''
        let currentPid = null
        let refreshTimer = null

        function currentId() {
          try {
            const svc = ctx.get('sessions')
            const snap = svc && svc.list && typeof svc.list.getSnapshot === 'function' ? svc.list.getSnapshot() : null
            return snap && snap.current ? String(snap.current) : ''
          } catch (e) {
            return ''
          }
        }

        function renderChip(projectName) {
          if (!currentSessionId) {
            chip.style.display = 'none'
            return
          }
          chip.style.display = 'inline-flex'
          chip.textContent = projectName ? '📁 ' + projectName : '📁 未归类'
        }

        // Event-driven refresh: the fetch only runs when the current session
        // changes or an assignment mutation is notified — never on a timer.
        function refreshBadge() {
          const id = currentId()
          if (!id) {
            currentSessionId = ''
            currentPid = null
            renderChip('')
            return
          }
          if (id !== currentSessionId) {
            currentSessionId = id
            hideMenu()
          }
          fetch(API_PREFIX + '/project-of?sessionId=' + encodeURIComponent(currentSessionId))
            .then(function (r) {
              return r.json()
            })
            .then(function (j) {
              currentPid = j && j.projectId ? j.projectId : null
              renderChip(j && j.projectName ? j.projectName : '')
            })
            .catch(function () {})
        }

        function tick() {
          // Cheap DOM/snapshot check only: re-attach the chip if the app
          // rebuilt the pane, and detect session switches without fetching.
          attach()
          const id = currentId()
          if (id !== currentSessionId) refreshBadge()
        }

        function bh(tag, cls, text) {
          const el = d.createElement(tag)
          if (cls) el.className = cls
          if (text !== undefined && text !== null) el.textContent = text
          return el
        }

        function buildMenu() {
          clear2(menu)
          menu.appendChild(bh('div', 'pm-section-title', '归属项目'))
          api('state')
            .then(function (st) {
              const projects = Array.isArray(st.projects) ? st.projects : []
              const curPid = currentPid
              projects.forEach(function (p) {
                const rowEl = bh('div', 'pm-sess' + (p.id === curPid ? ' sel' : ''))
                const label = bh('span', 'pm-sess-title', p.name)
                if (p.id === curPid) label.style.fontWeight = '600'
                rowEl.appendChild(label)
                menu.appendChild(rowEl)
                rowEl.addEventListener('click', function () {
                  assignTo(p.id)
                })
              })
              const unrow = bh('div', 'pm-sess' + (curPid ? '' : ' sel'))
              unrow.appendChild(bh('span', 'pm-sess-title', '移出项目（未归类）'))
              menu.appendChild(unrow)
              unrow.addEventListener('click', function () {
                assignTo(null)
              })
              menu.style.display = 'block'
            })
            .catch(function (e) {
              console.error('[projects-mode]', e)
            })
        }

        function clear2(node) {
          while (node.firstChild) node.removeChild(node.firstChild)
        }

        function assignTo(pid) {
          hideMenu()
          assignSession(currentSessionId, pid)
            .then(function () {
              chip.textContent = pid === null ? '📁 已移出项目 ✓' : '📁 已归入项目 ✓'
              window.setTimeout(function () {
                refreshBadge()
              }, 900)
            })
            .catch(function (e) {
              console.error('[projects-mode]', e)
              chip.textContent = '✗ 归属修改失败'
              window.setTimeout(function () {
                refreshBadge()
              }, 1600)
            })
        }

        function hideMenu() {
          menu.style.display = 'none'
        }

        chip.addEventListener('click', function (e) {
          e.stopPropagation()
          if (menu.style.display === 'block') hideMenu()
          else buildMenu()
        })
        menu.addEventListener('click', function (e) {
          e.stopPropagation()
        })

        function attach() {
          const pane = d.querySelector("[data-pane='conversation'], [class*='centerCol']")
          if (pane === null) return false
          if (chip.parentElement !== pane) {
            pane.appendChild(chip)
            pane.appendChild(menu)
          }
          return true
        }

        attach()
        refreshBadge()
        // Slow tick only re-attaches the chip and detects session switches;
        // assignment changes arrive via assignSubs notifications instead of
        // the old 4s fetch poll + whole-body MutationObserver.
        refreshTimer = setInterval(tick, 2500)
        const onAssigned = function (sid) {
          if (sid && sid === currentSessionId) refreshBadge()
        }
        assignSubs.add(onAssigned)
        const docClick = function () {
          hideMenu()
        }
        d.addEventListener('click', docClick)

        return function () {
          if (refreshTimer !== null) clearInterval(refreshTimer)
          assignSubs.delete(onAssigned)
          d.removeEventListener('click', docClick)
          chip.remove()
          menu.remove()
        }
      }

      console.log('[projects-mode] client half mounted')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
