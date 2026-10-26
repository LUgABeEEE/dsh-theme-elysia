/**
 * dsh-theme-elysia —— 浏览器半端（设置里的「乐土礼堂」一页）
 *
 * 【web profile 适配】(2026-10-26)
 *   原包是给桌面端（Electron，profile=desktop）写的；这里只改了两处：
 *   package.json 的 dsh.client.inject 换成本机真实存在的包名，
 *   服务端去掉 Windows 专用的端口文件逻辑、样式改走 webserver/index-inject。
 *   这个文件本身与 DSH 0.2.1-rc.2 的客户端契约一致：settings.section 是 list 槽、
 *   conversation.hero.brand.mark 的 owner props 就是 { size, className }，未改逻辑。
 * ============================================================================
 * ⭐ client bundle 不是 ESM，是自注册脚本：
 *     window.__ModuleLoader__.load({ id: '<包名>', factory: (require) => ({...}) })
 *    id 必须等于 package.json 的 name，否则活下来却不登记。
 *
 * 这一页只干一件事：把那面墙的四个旋钮和一张底图交到使用者手里。
 *   · 透明度   —— 图退到后面去，字才压得住
 *   · 放大     —— 转起来不露边的那个余量
 *   · 晃动幅度 —— 圆轨迹的半径
 *   · 晃动速度 —— 一圈几秒
 *
 * 为什么改半径要整段重写 keyframes：Chrome 动画一旦跑起来就不回头重读
 * keyframes 里的 var()，光改变量它纹丝不动。所以每次改都是一份新的动画名，
 * 等于把动画重启一次 —— 这也是为什么这里自己拼 CSS，而不是设个变量了事。
 * ============================================================================
 */
window.__ModuleLoader__.load({
  id: 'dsh-theme-elysia',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const API = '/api/elysia-theme'
    const LIVE_ID = 'elysia-theme-live'

    const asJson = async (res) => {
      if (res.ok) return res.json()
      throw new Error('HTTP ' + res.status)
    }
    const jget = async (p) => asJson(await fetch(API + p, { credentials: 'same-origin' }))
    const jsend = async (p, method, body) => asJson(await fetch(API + p, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }))

    /* ───────── 把配置翻成 CSS（与宿主 lib/index.js 的 orbitCss 同一套规则） ───────── */

    let seq = 0

    function orbitCss(cfg, tag) {
      const z = Number(cfg.zoom).toFixed(3)
      const r = Number(cfg.radius)
      const k = r * Math.SQRT1_2
      const pt = (x, y) => 'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, 0)'
      const frames = [
        [0, -r, 0], [12.5, -k, -k], [25, 0, -r], [37.5, k, -k], [50, r, 0],
        [62.5, k, k], [75, 0, r], [87.5, -k, k], [100, -r, 0],
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
        'html body:not([data-ds-dark-theme])::before { animation: ' + name + ' '
          + cfg.period + 's linear infinite; }',
      ].join('\n')
    }

    // 即时预览：换一个新名字压上去，顺手把动画重启
    function applyLive(cfg) {
      let el = document.getElementById(LIVE_ID)
      if (!el) {
        el = document.createElement('style')
        el.id = LIVE_ID
        document.head.appendChild(el)
      }
      seq += 1
      el.textContent = orbitCss(cfg, 'ui' + seq)
    }

    /* ───────── 首页那行大字：换她自己的招呼 ─────────
     * 「探索未至之境」是 i18n 里的一条（hero.headline），文本躺在 app.asar 里，
     * 改包一下就会连签名一起坏掉 —— 所以不去动它，改在页面上把那个文本节点换掉。
     * React 每次重渲染都可能把原句摆回来，所以挂一个 MutationObserver 盯着。
     * 只认「整段文本刚好等于原句」的那个空 span，别的地方一个字不碰。
     */

    const HERO_OLD = ['探索未至之境', 'Into the Unknown']
    const HERO_NEW = '嗨♪爱愿妖精♥'
    const BRAND_ATTR = 'data-elysia-brand'

    function brandHero() {
      let spans
      try {
        spans = document.querySelectorAll('span')
      } catch (e) {
        return
      }
      for (const span of spans) {
        if (span.childElementCount !== 0) continue
        if (span.getAttribute(BRAND_ATTR) === '1') continue
        const raw = span.textContent || ''
        if (HERO_OLD.indexOf(raw.trim()) < 0) continue
        span.setAttribute(BRAND_ATTR, '1')
        const mark = document.createElement('span')
        mark.className = 'elysia-hero-wordmark'
        mark.textContent = HERO_NEW
        span.textContent = ''
        span.appendChild(mark)
      }
    }

    // 便宜的先决判断：整棵树里连原句都没有就别去扫 span 了
    function heroMaybePending() {
      const body = document.body
      if (!body) return false
      const text = body.textContent
      if (!text) return false
      for (const w of HERO_OLD) if (text.indexOf(w) >= 0) return true
      return false
    }

    const CSS = `
[data-et-page]{display:flex;flex-direction:column;gap:20px;padding:2px 2px 10px;max-width:680px;}
[data-et-sec]{display:flex;flex-direction:column;gap:10px;}
[data-et-h]{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-et-row]{display:flex;align-items:center;gap:12px;}
[data-et-grow]{flex:1;min-width:0;}
[data-et-label]{font-size:13px;}
[data-et-note]{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-et-val]{font-size:11.5px;font-variant-numeric:tabular-nums;min-width:56px;text-align:right;
  color:var(--dsw-alias-label-secondary,#c9ccd1);}
[data-et-range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;
  background:var(--dsw-alias-border-l2,rgba(128,128,128,.28));outline:none;cursor:pointer;margin:6px 0;}
[data-et-range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;
  background:#e8829f;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;}
[data-et-range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#e8829f;
  border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;}
[data-et-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;}
[data-et-card]{position:relative;border-radius:9px;overflow:hidden;cursor:pointer;padding:0;
  border:2px solid transparent;background:none;aspect-ratio:16/9;display:block;}
[data-et-card][data-on]{border-color:#e8829f;}
[data-et-card] img{width:100%;height:100%;object-fit:cover;display:block;}
[data-et-card] span{position:absolute;left:0;right:0;bottom:0;padding:3px 6px;font-size:10.5px;
  text-align:left;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.55));
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
[data-et-del]{position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:50%;border:0;
  cursor:pointer;font-size:11px;line-height:18px;padding:0;color:#fff;background:rgba(0,0,0,.5);}
[data-et-btn]{padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.14));color:inherit;}
[data-et-btn]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.24));}
[data-et-msg]{font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;
  background:var(--dsw-alias-bg-overlay,rgba(128,128,128,.12));
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-et-msg][data-warn]{color:#f59e0b;}
[data-et-msg][data-good]{color:#22c55e;}
`

    /* ───────── 小组件 ───────── */

    function Slider({ label, note, value, min, max, step, unit, format, onChange }) {
      const show = format ? format(value) : (value + (unit || ''))
      return h('div', { 'data-et-sec': '', style: { gap: '2px' } },
        h('div', { 'data-et-row': '' },
          h('div', { 'data-et-grow': '' }, h('div', { 'data-et-label': '' }, label)),
          h('div', { 'data-et-val': '' }, show)),
        h('input', {
          'data-et-range': '',
          type: 'range',
          min, max, step,
          value,
          onChange: (e) => onChange(Number(e.target.value)),
        }),
        note ? h('div', { 'data-et-note': '' }, note) : null)
    }

    /* ───────── 那一页 ───────── */

    function Panel() {
      const [cfg, setCfg] = React.useState(null)
      const [limits, setLimits] = React.useState(null)
      const [imgs, setImgs] = React.useState([])
      const [active, setActive] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [msg, setMsg] = React.useState(null)
      const timer = React.useRef(null)
      const fileInput = React.useRef(null)
      const latest = React.useRef(null)

      const load = React.useCallback(async () => {
        try {
          const d = await jget('/config')
          setCfg(d.config)
          setLimits(d.limits)
          latest.current = d.config
          const b = await jget('/bg')
          setImgs(b.images || [])
          setActive(b.active || '')
        } catch (e) {
          setMsg({ warn: true, text: '读不到配置：' + e.message })
        }
      }, [])

      React.useEffect(() => { load() }, [load])

      // 一串拖动只写一次盘
      const flush = React.useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(async () => {
          try {
            await jsend('/config', 'POST', latest.current)
            setMsg({ good: true, text: '记住啦，下次开机还是这样' })
          } catch (e) {
            setMsg({ warn: true, text: '保存失败：' + e.message })
          }
        }, 450)
      }, [])

      const change = (patch) => {
        setCfg((prev) => {
          const next = { ...prev, ...patch }
          latest.current = next
          applyLive(next)
          return next
        })
        setMsg(null)
        flush()
      }

      const pickBg = async (name) => {
        try {
          setBusy(true)
          await jsend('/config', 'POST', { bg: name })
          setActive(name)
          setMsg({ good: true, text: '底图换了，刷新一次就看得见' })
          setTimeout(() => { try { location.reload() } catch (e) {} }, 380)
        } catch (e) {
          setMsg({ warn: true, text: '换不了这张：' + e.message })
        } finally { setBusy(false) }
      }

      const upload = async (file) => {
        if (!file) return
        if (file.size > 12 * 1024 * 1024) {
          setMsg({ warn: true, text: '这张超过 12MB 啦，挑小一点的吧' })
          return
        }
        try {
          setBusy(true)
          const dataUrl = await new Promise((res, rej) => {
            const fr = new FileReader()
            fr.onload = () => res(String(fr.result))
            fr.onerror = () => rej(new Error('读不出来'))
            fr.readAsDataURL(file)
          })
          // 文件名里别带中文和空格，落到磁盘上省心
          const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.png'])[0].toLowerCase()
          const safe = 'bg-' + Date.now().toString(36) + ext
          await jsend('/bg', 'POST', { name: safe, dataUrl })
          const b = await jget('/bg')
          setImgs(b.images || [])
          setMsg({ good: true, text: '收好了，点一下它就能用' })
        } catch (e) {
          setMsg({ warn: true, text: '传不上去：' + e.message })
        } finally { setBusy(false) }
      }

      const removeImg = async (name) => {
        try {
          setBusy(true)
          const d = await fetch(API + '/bg?name=' + encodeURIComponent(name), {
            method: 'DELETE', credentials: 'same-origin',
          })
          if (!d.ok) throw new Error('HTTP ' + d.status)
          const b = await jget('/bg')
          setImgs(b.images || [])
          setActive(b.active || '')
          setMsg({ good: true, text: '删掉了' })
        } catch (e) {
          setMsg({ warn: true, text: '删不掉：' + e.message })
        } finally { setBusy(false) }
      }

      const reset = async () => {
        try {
          await jsend('/reset', 'POST', {})
          await load()
          latest.current && applyLive(latest.current)
          setMsg({ good: true, text: '回到出厂的样子了' })
        } catch (e) {
          setMsg({ warn: true, text: '恢复失败：' + e.message })
        }
      }

      if (!cfg || !limits) return h('div', { 'data-et-page': '' },
        h('div', { 'data-et-msg': '', 'data-warn': '' }, msg ? msg.text : '正在读配置……'))

      return h('div', { 'data-et-page': '' },

        h('div', { 'data-et-sec': '' },
          h('div', { 'data-et-note': '' },
            '这面墙是整张画出来的礼堂，慢到几乎察觉不到就不算动。下面几个旋钮改完立刻生效，不用刷新。')),

        h('div', { 'data-et-sec': '' },
          h('div', { 'data-et-h': '' }, '画面'),
          h(Slider, {
            label: '背景透明度',
            note: '拉低一点，字就浮上来，图退到后面去',
            value: cfg.opacity, min: limits.opacity[0], max: limits.opacity[1], step: 0.01,
            format: (v) => Math.round(v * 100) + '%',
            onChange: (v) => change({ opacity: v }),
          }),
          h(Slider, {
            label: '放大',
            note: '转起来不露白底的余量，觉得边缘空就把这个往上推',
            value: cfg.zoom, min: limits.zoom[0], max: limits.zoom[1], step: 0.01,
            format: (v) => Math.round(v * 100) + '%',
            onChange: (v) => change({ zoom: v }),
          })),

        h('div', { 'data-et-sec': '' },
          h('div', { 'data-et-h': '' }, '晃动'),
          h(Slider, {
            label: '晃动强度',
            note: '圆轨迹的半径。0 就是彻底不晃',
            value: cfg.radius, min: limits.radius[0], max: limits.radius[1], step: 1,
            format: (v) => Math.round(v) + ' px',
            onChange: (v) => change({ radius: v }),
          }),
          h(Slider, {
            label: '晃动速度',
            note: '一圈要走多久，数字越小转得越快',
            value: cfg.period, min: limits.period[0], max: limits.period[1], step: 1,
            format: (v) => Math.round(v) + ' 秒/圈',
            onChange: (v) => change({ period: v }),
          })),

        h('div', { 'data-et-sec': '' },
          h('div', { 'data-et-row': '' },
            h('div', { 'data-et-grow': '' }, h('div', { 'data-et-h': '' }, '背景图')),
            h('button', {
              'data-et-btn': '', disabled: busy,
              onClick: () => fileInput.current && fileInput.current.click(),
            }, '上传一张'),
            h('input', {
              ref: fileInput, type: 'file', accept: 'image/*', style: { display: 'none' },
              onChange: (e) => {
                const f = e.target.files && e.target.files[0]
                upload(f)
                e.target.value = ''
              },
            })),
          h('div', { 'data-et-grid': '' },
            h('div', {
              'data-et-card': '', 'data-on': active ? undefined : '',
              title: '乐土礼堂（自带）',
              onClick: () => { if (!busy) pickBg('') },
            },
              h('img', { src: API + '/bg/raw', alt: '' }),
              h('span', {}, '乐土礼堂（自带）')),
            imgs.map((im) => h('div', {
              key: im.name,
              'data-et-card': '', 'data-on': active === im.name ? '' : undefined,
              title: im.name,
              onClick: () => { if (!busy) pickBg(im.name) },
            },
              h('img', { src: API + '/bg/raw?name=' + encodeURIComponent(im.name), alt: '' }),
              h('span', {}, im.name),
              h('button', {
                'data-et-del': '', title: '删掉这张',
                onClick: (e) => { e.stopPropagation(); removeImg(im.name) },
              }, '×')))),
          h('div', { 'data-et-note': '' },
            '换底图要刷一次页面才算数 —— 图是直接编进样式里递过去的，不是链接。')),

        h('div', { 'data-et-row': '' },
          h('button', { 'data-et-btn': '', onClick: reset }, '恢复默认'),
          msg ? h('div', {
            'data-et-msg': '', 'data-et-grow': '',
            'data-warn': msg.warn ? '' : undefined,
            'data-good': msg.good ? '' : undefined,
          }, msg.text) : null))
    }

    // 首页标题旁边那块牌子。宿主给的是 { size, className }：
    // size 是它按字号算出来的 34，className 是它自己的 fish 类（保留了外层 hitbox 的悬停小动作）。
    // 牌子的图比原鲸鱼细，稍微放大一点才看得清眼睛 —— 14% 不会把那一行撑开。
    function HeroMark(props) {
      const p = props || {}
      const base = Number(p.size)
      const px = Math.max(24, Math.round((base > 0 ? base : 34) * 1.14))
      return h('img', {
        src: API + '/mark',
        alt: '',
        draggable: false,
        width: px,
        height: px,
        className: (p.className ? p.className + ' ' : '') + 'elysia-hero-mark',
        style: { width: px + 'px', height: px + 'px', objectFit: 'contain', display: 'block' },
        // 图没取到就自己退场，别在标题旁边留一个破图标
        onError: (e) => {
          const el = e && e.currentTarget
          if (el && el.parentNode) el.parentNode.removeChild(el)
        },
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-theme-elysia')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-theme-elysia: 设置页样式')

        // 首页招呼：先补一次（插件可能比首页晚一步到），之后每 200ms 至多补一次
        let brandTick = 0
        let brandOn = true
        const paintBrand = () => {
          brandTick = 0
          if (!brandOn) return
          try { brandHero() } catch (e) { /* 页面还没搭好，下一轮再来 */ }
        }
        const queueBrand = () => {
          if (brandTick || !brandOn) return
          brandTick = setTimeout(paintBrand, 200)
        }
        paintBrand()
        // 全树盯梢太吵：先限流，再只做一遍便宜的文本判断，真发现了才去扫 span
        let lastProbe = 0
        const mo = new MutationObserver(() => {
          if (!brandOn) return
          const now = Date.now()
          if (now - lastProbe < 400) return
          lastProbe = now
          if (heroMaybePending()) queueBrand()
        })
        try {
          mo.observe(document.documentElement, { childList: true, subtree: true })
        } catch (e) { /* 老引擎没有 MutationObserver 也不至于崩 */ }
        ctx.effect(() => () => {
          brandOn = false
          if (brandTick) { clearTimeout(brandTick); brandTick = 0 }
          mo.disconnect()
        }, 'dsh-theme-elysia: 首页招呼')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'elysia-hall', order: 31, label: '乐土礼堂' },
          () => h(Panel),
        ))

        // 首页那块牌子：宿主自己会从这个槽里取（fallback 是它那条小鱼）。
        // 注册不上就什么也不做 —— 那条小鱼还在，页面不会缺一块。
        try {
          slots.inject('conversation.hero.brand.mark', () => slots.register(
            { name: 'conversation.hero.brand.mark' },
            HeroMark,
          ))
        } catch (e) { /* 宿主版本没有这个槽，算了 */ }
      },
    }
  },
})
