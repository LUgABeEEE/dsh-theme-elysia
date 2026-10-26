// dsh-theme-elysia web 适配版 · 服务端半端冒烟测试
// 不启动 DSH、不碰真实配置：用假的 cordis root + 假 webServer 走一遍注入与路由。
// 用法：HOME=/tmp/elysia-smoke-home node tests/smoke.mjs
import http from 'node:http'
import os from 'node:os'

const mod = await import('../lib/index.js')
const plugin = mod.default

const rows = []
const listeners = []
const routes = new Map()
const taps = []
const disposers = []

const fakeRoot = {
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
    return () => {}
  },
  on(event, cb) {
    listeners.push({ event, cb })
    return () => {}
  },
  inject(deps, cb) {
    cb({
      webServer: {
        register(route) {
          routes.set(route.path, route)
          return () => {}
        },
        tapIndex(fn) {
          taps.push(fn)
          return () => {}
        },
      },
    })
  },
}

plugin.apply(fakeRoot)

const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) process.exitCode = 1
}

// 1) index 注入表
for (const l of listeners) if (l.event === 'webserver/index-inject') l.cb(rows)
ok('注入一行 style', rows.length === 1 && rows[0].kind === 'style')
const css = rows[0]?.text || ''
ok('样式带包标识', css.includes('dsh-theme-elysia'))
ok('底图内联成 data URI', css.includes('data:image/webp;base64,'), `${css.length} 字节`)
ok('色阶 token 在', css.includes('--dsw-static-neutral-bluish-500'))
ok('轨迹 keyframes 在', css.includes('@keyframes elysia-hall-orbit-boot'))

// 重复 emit 不应堆叠
for (const l of listeners) if (l.event === 'webserver/index-inject') l.cb(rows)
ok('重复 emit 不重复注入', rows.length === 1)

// 2) tapIndex 兜底应在已有 marker 时跳过
ok('tapIndex 兜底跳过', taps.length === 1 && taps[0]('<html><head></head></html>').includes('dsh-theme-elysia'))

// 3) 路由：GET /config
const route = routes.get('/api/elysia-theme')
ok('注册了 /api/elysia-theme 前缀路由', !!route)

function call(method, path, { body, headers } = {}) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage(null)
    req.method = method
    req.url = path
    req.headers = { host: '127.0.0.1:3080', ...(headers || {}) }
    if (body) {
      const buf = Buffer.from(JSON.stringify(body))
      req.push(buf)
      req.push(null)
    } else if (method !== 'GET') {
      req.push(null)
    }
    const chunks = []
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(code, h) { this.statusCode = code; this.headers = h || {} },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk))
        resolve({
          code: this.statusCode,
          headers: this.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        })
      },
    }
    Promise.resolve(route.handler(req, res)).catch((e) => resolve({ code: -1, text: String(e) }))
  })
}

const cfg = await call('GET', '/api/elysia-theme/config')
const cfgJson = JSON.parse(cfg.text)
ok('GET /config 200', cfg.code === 200 && cfgJson.ok === true)
ok('默认旋钮齐', cfgJson.config.opacity === 1 && cfgJson.limits.period[1] === 120)

const bg = await call('GET', '/api/elysia-theme/bg')
ok('GET /bg 200', bg.code === 200 && JSON.parse(bg.text).builtin.size > 0)

// 4) 同源校验：跨站写请求应被拒
const evil = await call('POST', '/api/elysia-theme/config', {
  body: { opacity: 0.5 },
  headers: { origin: 'https://evil.example' },
})
ok('跨站 POST 被拒 403', evil.code === 403)

const same = await call('POST', '/api/elysia-theme/config', {
  body: { opacity: 0.66 },
  headers: { origin: 'http://127.0.0.1:3080' },
})
const sameJson = JSON.parse(same.text)
ok('同源 POST 生效', same.code === 200 && sameJson.config.opacity === 0.66)

ok('配置文件落在 HOME 下', cfgJson.ok === true && (await import('node:fs')).existsSync(
  `${process.env.HOME}/.dsh/elysia-theme/config.json`), process.env.HOME)

// 5) 清理
for (const d of disposers) { try { d() } catch (e) {} }
console.log('done, HOME=' + process.env.HOME, 'homedir=' + os.homedir())
