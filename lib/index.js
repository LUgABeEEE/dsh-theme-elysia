import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

// 包根：lib/index.js -> 包根。link 安装与 node_modules 安装都能定位。
const HERE = path.dirname(fileURLToPath(import.meta.url))
const CSS_PATH = path.join(HERE, 'elysia.css')
const HALL_PATH = path.join(HERE, 'hall.webp')
// 首页那块小牌子（黑底抠好的小爱头像）。客户端的 slot 里是 <img>，指到 /api/elysia-theme/mark。
const MARK_PATH = path.join(HERE, 'elysia-mark.png')
const HALL_TOKEN = '__HALL_IMAGE__'
const STYLE_ID = 'dsh-theme-elysia'
const MARKER = 'dsh-theme-elysia' // CSS 首行注释里也有这个标识，用来去重

// ————————————————————————————— 可调的那几个旋钮 —————————————————————————————
// 配置和用户自己传的背景图都放在家目录，**不放进插件目录**：
// 插件是 link 装的，重装一次整个包可能被换掉，旋钮不该跟着一起丢。
// SER8 上 os.homedir() 是 /data/agent ⇒ /data/agent/.dsh/elysia-theme。
const DATA_DIR = path.join(os.homedir(), '.dsh', 'elysia-theme')
const CONFIG_PATH = path.join(DATA_DIR, 'config.json')
const BG_DIR = path.join(DATA_DIR, 'bg')

const DEFAULTS = { opacity: 1, zoom: 1.08, radius: 15, period: 30, bg: '' }
// 上界不是随便定的：::before 现在 inset:-5%，纵向 5% 在 1080p 上约 54px，
// 半径给到 40 已经留足余量，再大就会在圆的顶点上看见白底。
const LIMITS = {
  opacity: [0.2, 1],
  zoom: [1.02, 1.26],
  radius: [0, 40],
  period: [8, 120],
}
const IMG_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.avif'])
const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
}

function clampNum(v, lo, hi, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}

function safeName(name) {
  const base = path.basename(String(name || ''))
  if (!base || base !== String(name || '')) return ''
  if (!IMG_EXT.has(path.extname(base).toLowerCase())) return ''
  return base
}

function sanitize(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const out = {
    opacity: clampNum(c.opacity, LIMITS.opacity[0], LIMITS.opacity[1], DEFAULTS.opacity),
    zoom: clampNum(c.zoom, LIMITS.zoom[0], LIMITS.zoom[1], DEFAULTS.zoom),
    radius: clampNum(c.radius, LIMITS.radius[0], LIMITS.radius[1], DEFAULTS.radius),
    period: clampNum(c.period, LIMITS.period[0], LIMITS.period[1], DEFAULTS.period),
    bg: safeName(c.bg),
  }
  // 选中的图要是已经不在了，就退回包内那张，别留一个空背景。
  if (out.bg && !fs.existsSync(path.join(BG_DIR, out.bg))) out.bg = ''
  return out
}

function readConfig() {
  try {
    return sanitize(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')))
  } catch (err) {
    return sanitize(DEFAULTS)
  }
}

function writeConfig(patch) {
  const next = sanitize({ ...readConfig(), ...(patch && typeof patch === 'object' ? patch : {}) })
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return next
}

function listBg() {
  const out = []
  try {
    for (const f of fs.readdirSync(BG_DIR, { withFileTypes: true })) {
      if (!f.isFile()) continue
      const name = safeName(f.name)
      if (!name) continue
      let size = 0
      try { size = fs.statSync(path.join(BG_DIR, name)).size } catch (err) {}
      out.push({ name, size })
    }
  } catch (err) {}
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

// 背景图也每次现读，编码成 data URI 塞进 CSS。
// 页面是 http://127.0.0.1 起的，file:// 的图会被拦下来，所以只能内联。
// 缓存按「路径 + mtime」记 —— 两份图各留一份，来回换不会一直重编码。
const uriCache = new Map()
function hallDataUri(name) {
  const file = name ? path.join(BG_DIR, name) : HALL_PATH
  try {
    const st = fs.statSync(file)
    const hit = uriCache.get(file)
    if (hit && hit.mtime === st.mtimeMs) return hit.uri
    const mime = MIME[path.extname(file).toLowerCase()] || 'image/webp'
    const uri = 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64')
    uriCache.set(file, { mtime: st.mtimeMs, uri })
    return uri
  } catch (err) {
    return ''
  }
}

// 把旋钮翻成 CSS。宿主注入时生成一份（tag=boot），设置页改完再生成一份压上去。
// 半径和放大**必须重写整段 keyframes**，光改变量没用：Chrome 动画跑起来之后
// 不会回头重读 keyframes 里的 var()，改了也不动 —— 换个名字就是重启动画。
function orbitCss(cfg, tag) {
  const z = cfg.zoom.toFixed(3)
  const r = cfg.radius
  const k = r * Math.SQRT1_2
  const pt = (x, y) => 'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, 0)'
  const frames = [
    [0, -r, 0],
    [12.5, -k, -k],
    [25, 0, -r],
    [37.5, k, -k],
    [50, r, 0],
    [62.5, k, k],
    [75, 0, r],
    [87.5, -k, k],
    [100, -r, 0],
  ]
  const name = 'elysia-hall-orbit-' + tag
  const body = frames.map(([p, x, y]) =>
    p + '% { transform: scale(' + z + ') ' + pt(x, y) + '; }').join('\n  ')
  return [
    ':root {',
    '  --elysia-bg-opacity: ' + cfg.opacity + ';',
    '  --elysia-bg-zoom: ' + z + ';',
    '  --elysia-orbit-r: ' + r + 'px;',
    '  --elysia-orbit-dur: ' + cfg.period + 's;',
    '}',
    '@keyframes ' + name + ' {',
    '  ' + body,
    '}',
    // 只压浅色那一套；深色「夜樱花」不挂这张照片，也就没有轨迹可言。
    'html body:not([data-ds-dark-theme])::before { animation: ' + name + ' '
      + cfg.period + 's linear infinite; }',
  ].join('\n')
}

// CSS 每次注入时现读：改 elysia.css 之后重开界面就生效，不用重新装包。
function readCss(tag) {
  let css = ''
  try { css = fs.readFileSync(CSS_PATH, 'utf8') } catch (err) { return '' }
  const cfg = readConfig()
  if (css.indexOf(HALL_TOKEN) !== -1) css = css.split(HALL_TOKEN).join(hallDataUri(cfg.bg))
  return css + '\n\n/* —— 设置页那一份 —— */\n' + orbitCss(cfg, tag || 'boot') + '\n'
}

// ——————————————————————————————— HTTP 那一小块 ———————————————————————————————

const JSON_LIMIT = 16 * 1024 * 1024 // 传图走的是 base64，放宽一点

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > JSON_LIMIT) { reject(new Error('图太大了（超过 16MB）')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// 写接口只认同源：浏览器跨站 POST 会带自己的 Origin，这里直接挡掉，
// 免得页面上任何一条第三方脚本顺手改配置或传图。非浏览器客户端不带 Origin，照旧放行。
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === String(req.headers.host || '')
  } catch (err) {
    return false
  }
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1')
  const p = url.pathname.replace(/\/+$/, '')

  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'cross-origin write rejected' })
  }

  if (req.method === 'GET' && p === '/api/elysia-theme/config') {
    const cfg = readConfig()
    return sendJson(res, 200, { ok: true, config: cfg, defaults: DEFAULTS, limits: LIMITS })
  }

  if (req.method === 'POST' && p === '/api/elysia-theme/config') {
    let patch = {}
    try { patch = JSON.parse(await readBody(req) || '{}') } catch (err) {
      return sendJson(res, 400, { ok: false, error: '看不懂这份配置：' + err.message })
    }
    const cfg = writeConfig(patch)
    return sendJson(res, 200, { ok: true, config: cfg, css: orbitCss(cfg, 'live' + Date.now()) })
  }

  if (req.method === 'POST' && p === '/api/elysia-theme/reset') {
    try { fs.unlinkSync(CONFIG_PATH) } catch (err) {}
    return sendJson(res, 200, { ok: true, config: readConfig() })
  }

  if (req.method === 'GET' && p === '/api/elysia-theme/bg') {
    return sendJson(res, 200, {
      ok: true,
      images: listBg(),
      active: readConfig().bg,
      builtin: { name: '乐土礼堂（自带）', size: (() => {
        try { return fs.statSync(HALL_PATH).size } catch (err) { return 0 }
      })() },
    })
  }

  // 传图：body = { name, dataUrl:'data:image/...;base64,...' }
  if (req.method === 'POST' && p === '/api/elysia-theme/bg') {
    let body = {}
    try { body = JSON.parse(await readBody(req) || '{}') } catch (err) {
      return sendJson(res, 400, { ok: false, error: '看不懂这张图：' + err.message })
    }
    const name = safeName(body.name)
    if (!name) return sendJson(res, 400, { ok: false, error: '只收 webp / png / jpg / avif 的图' })
    const m = String(body.dataUrl || '').match(/^data:[^;,]+;base64,(.+)$/)
    if (!m) return sendJson(res, 400, { ok: false, error: '这张图没编码好' })
    let buf
    try { buf = Buffer.from(m[1], 'base64') } catch (err) {
      return sendJson(res, 400, { ok: false, error: '图解不开' })
    }
    if (!buf.length) return sendJson(res, 400, { ok: false, error: '图是空的' })
    // 自用也要有个上限：这个口子不做鉴权，别让人拿它把磁盘塞满。
    if (listBg().length >= 12) return sendJson(res, 429, { ok: false, error: '自带图库最多 12 张，先删一张再传' })
    fs.mkdirSync(BG_DIR, { recursive: true })
    fs.writeFileSync(path.join(BG_DIR, name), buf)
    return sendJson(res, 200, { ok: true, name, size: buf.length })
  }

  // 删除一张自己传的图
  if (req.method === 'DELETE' && p === '/api/elysia-theme/bg') {
    const name = safeName(url.searchParams.get('name') || '')
    if (!name) return sendJson(res, 400, { ok: false, error: '名字不对' })
    try { fs.unlinkSync(path.join(BG_DIR, name)) } catch (err) {}
    const cfg = readConfig()
    if (cfg.bg === name) writeConfig({ bg: '' })
    return sendJson(res, 200, { ok: true, config: readConfig() })
  }

  // 缩略图 / 原图直出。走这里而不是把 base64 塞进列表，
  // 否则每张图都要编进 JSON，一页设置能拖出好几兆。
  if (req.method === 'GET' && p === '/api/elysia-theme/bg/raw') {
    const want = url.searchParams.get('name') || ''
    const file = want ? path.join(BG_DIR, safeName(want)) : HALL_PATH
    if (want && (!safeName(want) || !fs.existsSync(file))) {
      res.writeHead(404); res.end('not found'); return
    }
    try {
      const buf = fs.readFileSync(file)
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'image/webp',
        'cache-control': 'no-cache',
        'content-length': buf.length,
      })
      res.end(buf)
    } catch (err) {
      res.writeHead(404); res.end('not found')
    }
    return
  }

  // 首页标题旁边那块牌子。图很小、又只在首页出现一次，直接直出，不塞 base64。
  if (req.method === 'GET' && p === '/api/elysia-theme/mark') {
    try {
      const buf = fs.readFileSync(MARK_PATH)
      res.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': 'no-cache',
        'content-length': buf.length,
      })
      res.end(buf)
    } catch (err) {
      res.writeHead(404); res.end('not found')
    }
    return
  }

  return sendJson(res, 404, { ok: false, error: 'unknown ' + req.method + ' ' + p })
}

export default {
  name: 'dsh-theme-elysia',
  apply(root) {
    const disposers = []
    root.effect(() => () => {
      for (const d of disposers) { try { d() } catch (err) {} }
    })

    // ① 样式走官方那条结构化注入表：宿主每次渲染 index.html 都 emit 一次，
    //    监听方把行 push 进去，最终落到 <head> 里、任何脚本之前 —— 不会先闪一下白底。
    //    web 与桌面共用这一条路径（0.2.x 的 dsh-host-webserver 自己 emit）。
    try {
      disposers.push(root.on('webserver/index-inject', (table) => {
        try {
          if (!Array.isArray(table)) return
          for (const row of table) {
            if (row && row.kind === 'style' && typeof row.text === 'string'
              && row.text.indexOf(MARKER) !== -1) return // 已经有我们这一行
          }
          const css = readCss('boot')
          if (!css) return
          table.push({ kind: 'style', text: css })
        } catch (err) {}
      }, { prepend: true }))
    } catch (err) {}

    // ② 兜底：万一这份 composition 不走结构化行，就退到 tapIndex 的原始 HTML 改写。
    //    tapIndex 在行渲染之后跑，所以上面那条生效时这里会看到 marker 直接跳过。
    try {
      root.inject(['webServer'], (ctx) => {
        try {
          const ws = ctx && ctx.webServer
          if (!ws) return

          // 设置页要读写的那个小接口。挂不上不影响主题本身，只是旋钮会失灵。
          if (typeof ws.register === 'function') {
            try {
              const off = ws.register({
                kind: 'prefix',
                path: '/api/elysia-theme',
                handler: async (req, res) => {
                  try { await handle(req, res) } catch (e) {
                    try { sendJson(res, 500, { ok: false, error: e && e.message ? e.message : String(e) }) } catch (err) {}
                  }
                },
              })
              if (typeof off === 'function') disposers.push(off)
            } catch (err) {}
          }

          if (typeof ws.tapIndex !== 'function') return
          disposers.push(ws.tapIndex((html) => {
            try {
              if (typeof html !== 'string' || html.indexOf(MARKER) !== -1) return html
              const css = readCss('boot')
              if (!css) return html
              const tag = '<style id="' + STYLE_ID + '">' + css + '</style>'
              if (html.indexOf('</head>') !== -1) return html.replace('</head>', tag + '</head>')
              return tag + html
            } catch (err) { return html }
          }))
        } catch (err) {}
      })
    } catch (err) {}
  },
}
