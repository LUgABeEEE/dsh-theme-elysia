// dsh-theme-elysia web 适配版 · 浏览器半端冒烟测试
// 用最小 DOM 桩把 client.js 跑一遍：确认它自注册、工厂产出 {inject, apply}、
// apply 会往 settings.section 与 conversation.hero.brand.mark 两个槽里登记。
// 用法：node tests/client-smoke.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(HERE, '..', 'client.js'), 'utf8')

const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) process.exitCode = 1
}

let registration = null
const head = []
const document = {
  head: { appendChild: (el) => { head.push(el); el.parentNode = { removeChild() {} }; return el } },
  createElement: (tag) => ({ tag, children: [], attrs: {}, className: '', style: {}, setAttribute(k, v) { this.attrs[k] = v }, appendChild(c) { this.children.push(c) }, remove() {}, textContent: '' }),
  getElementById: () => null,
  querySelectorAll: () => [],
  body: { textContent: '' },
  documentElement: {},
}
class MutationObserver {
  constructor(cb) { this.cb = cb }
  observe() {}
  disconnect() {}
}

globalThis.window = { __ModuleLoader__: { load: (reg) => { registration = reg } } }
globalThis.document = document
globalThis.MutationObserver = MutationObserver

const requireStub = (spec) => {
  if (spec === 'react') return { createElement: (type, props, ...kids) => ({ type, props, kids }), useState: () => [null, () => {}], useEffect: () => {}, useCallback: (f) => f, useRef: () => ({ current: null }) }
  throw new Error('unexpected require: ' + spec)
}

new Function('window', 'document', 'MutationObserver', 'require', src)(
  globalThis.window, document, MutationObserver, requireStub,
)

ok('自注册被捕获', !!registration)
ok('注册 id 正确', registration && registration.id === 'dsh-theme-elysia', registration && registration.id)

const mod = registration.factory(requireStub)
ok('工厂产出 inject 数组', Array.isArray(mod.inject) && mod.inject.includes('slots'), JSON.stringify(mod.inject))
ok('工厂产出 apply', typeof mod.apply === 'function')

const registered = []
const injected = []
const slots = {
  inject(name, fn) { injected.push(name); try { fn() } catch (e) { console.log('inject threw:', e.message) } return () => {} },
  register(opts, comp) { registered.push({ opts, comp }); return () => {} },
}
const effects = []
const ctx = {
  effect(fn, label) { const d = fn(); effects.push({ label, d }); return () => {} },
  get: (name) => (name === 'slots' ? slots : undefined),
  slots,
}

let threw = null
try { mod.apply(ctx) } catch (e) { threw = e }
ok('apply 不抛异常', !threw, threw ? threw.stack.split('\n')[0] : '')
ok('往 settings.section 注入', injected.includes('settings.section'), injected.join(','))
ok('往 hero.brand.mark 注入', injected.includes('conversation.hero.brand.mark'))
const section = registered.find((r) => r.opts.name === 'settings.section')
ok('设置页 id/order/label 齐', section && section.opts.id === 'elysia-hall' && section.opts.order === 31 && section.opts.label === '乐土礼堂')
ok('设置了 style 标签', head.length >= 1 && head[0].attrs['data-plugin-css'] === 'dsh-theme-elysia')
ok('登记了 cleanup effect', effects.length >= 1)
