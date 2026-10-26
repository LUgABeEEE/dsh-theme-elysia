# dsh-theme-elysia ——「乐土礼堂 · 白昼」

给 DSH 换一身配色的插件。主角是白天：往世乐土那座大厅的真身照片铺在底下，
奶油白的大理石、粉紫的穹顶、台阶尽头站着的人，上面压一层薄薄的米粉柔光，
再撒几粒樱瓣。深色那套「夜樱花」留在后面当备胎，系统切到深色时才亮。

## 这套颜色

| 用途 | 浅色（主角） | 深色（备胎） |
|---|---|---|
| 品牌粉 / 按钮 | `#d0446e` | `#f56a9e` |
| 骨架（最白 → 最深） | `#fdfaf7` → `#181010` | `#1f1a26` → `#121016` |
| 香槟金（镶边） | `#d0a054` | `#c29550` |
| 藕荷紫（链接、提示） | `#66508f` | `#745da4` |
| 焦点环 | `#d0446e` | `#ff8fbd` |

粉压得比看上去深一点，是为了白字站得住：按钮底与白字的对比度按 4.5:1 取的，
不是随便挑的好看值。

底色是 `lib/hall.webp` 那张礼堂照。上面叠了几层 `background-image`：
一层上浅下浓的米粉雾把画面柔下来，三团穹顶采光和地面反光，五粒樱瓣。

还有一处容易漏，而且最容易白忙一场：会话区那一整块画布是用
`--dsw-alias-bg-base` 铺的，而 `#root` 里一层套一层、**每一层都铺这个 token**。
半透明挂在 token 上的话，进一次对话框就叠三四层，叠完遮掉九成，图等于没有
（表现为「只有加载那一瞬间能看到」）。所以浅色这边直接把它写成 `transparent`，
把米白「纱」只铺一次、铺在 `body` 自己的 `background-color` 上——
不管上面套多少层，浓度都只算一次。

第二个坑更隐蔽：桌面壳在 Windows 标题栏模式下，会给 `[data-windows-titlebar] .BynINW_frame`
换一块**整屏**底板（`background: var(--dsw-specific-sidebar-fill)`），
而这个 token 引用的是 `--dsw-static-neutral-bluish-50`——
色阶一换，那块底板也跟着变成自定义的颜色，1280×822 的实色正好把整张照片盖死。
从中心点一层层往上爬是找不到它的（`elementFromPoint` 只拿得到最内层），
得靠**面积扫描**才能捞出来。CSS 最后那块 `html[data-windows-titlebar] body .BynINW_frame`
就是把它单独揭开的；侧栏、表头这些**还在用同一个 token 的地方保持不透明**，
不然字会飘在照片上。

## 它为什么能改到「任何地方」

不逐个组件改样式，只重绑底层的 `--dsw-static-*` 色阶：上层所有 alias token
（`--dsw-alias-bg-base`、`label-primary`、`border-l1`……）都引用这些色阶，
换掉它们，整个界面自己跟着变——包括插件写的、我还没看过的那些角落。

选择器带一层 `html`（`html body { … }`），比官方的 `body { … }` 多一级特异性，
所以不管谁的样式表后插入，这套都压得住。

改的族一共五个，档位与官方一一对齐（`amber` 5 档、`blue` 11 档、`deepseek` 11 档、
`neutral` 16 档、`neutral-bluish` 19 档）。`green`／`red` 故意没动——那是成功与
危险的语义色，染成粉的会出事。

## 两个入口

| 跑在哪 | 走哪条路 |
|---|---|
| 桌面端（Electron） | `webserver/index-inject` 推一行 `{ kind: 'style', text: css }`，启动时收集、脚本执行前就位 |
| 网页端 | `webServer.tapIndex` 把 `<style id="dsh-theme-elysia">` 插在 `</head>` 之前 |

CSS 每次注入时现读文件，所以改完 `lib/elysia.css` 重启一次界面就生效，不用重装。
桌面端那张注入表只在**启动时收集一次**，所以不重启是看不到变化的。

## 设置里那一页

`client.js` 是浏览器半端，挂进「设置」左侧导航，一页叫**乐土礼堂**：

| 旋钮 | 范围 | 管什么 |
|---|---|---|
| 背景透明度 | 20%–100% | 图退到多后面。拉低一点字就浮上来 |
| 放大 | 102%–126% | 转起来不露白底的余量 |
| 晃动强度 | 0–40 px | 圆轨迹的半径，`0` 就是彻底不晃 |
| 晃动速度 | 8–120 秒/圈 | 一圈走多久 |

外加一个图库：自带那张 + 自己上传的（webp / png / jpg / avif，单张 12MB 以内）。

旋钮改完**立刻生效、不用刷新**：`::before` 挂在圆轨迹上缓慢平移（八段近似，`cos45°`
取 0.7071，配 `linear`——换成 `ease` 会在每段拐点上打一次拍子）。半径和放大必须整段
重写 `@keyframes`，因为 **Chrome 动画跑起来之后不会回头重读 keyframes 里的 `var()`**，
只改变量它纹丝不动；所以每次改都是一个新的动画名，等于把动画重启一次。

换底图要刷一次页面才算数——图是被编码成 `data:` URI 直接编进样式里递过去的，不是链接。

配置和上传的图放在 `~/.dsh/elysia-theme/`（`config.json` + `bg/`），**不放插件目录**：
插件是 link 装的，重装一次整个包可能被换掉，旋钮不该跟着一起丢。

## 想自己调色

打开 `lib/elysia.css`，只动两个地方：

1. **浅色块** `html body { … }` —— 改 `--dsw-static-neutral-bluish-*`（界面骨架）
   与 `--dsw-static-deepseek-*`（品牌色）。块尾那串 `background-image` 就是礼堂。
2. **深色块** `html body[data-ds-dark-theme] { … }` —— 同上。

色阶后面数字越大越深（`1000` 最深、`00` 最白），改名不用管层级，照原来的明度
关系换成自己喜欢的色就行。

## 想换张真图当底

**先看设置里那一页**——在那儿上传一张、点一下就能换，不用碰文件。

想换成默认那张、又想彻底替换的话：底图是 `lib/hall.webp`（往世乐土大厅那张，1920×1202）。

1. 把新图存成 `lib/hall.webp`（横图、宽 1600–2000px、没有水印和 UI 文字）。
   原图左上角那枚「崩坏3」logo 是靠裁掉左边一条边去掉的，右边和下边是干净的。
2. 重启应用。

插件启动时会把这张图编码成 `data:` URI 填进 CSS 里的 `__HALL_IMAGE__` 占位符——
页面是 `http://127.0.0.1` 起的，`file://` 的图会被浏览器拦掉，只能内联。

两层要紧的东西别一起动：

- **`background-image` 最后一层**是那张图，上面几层是米粉雾和光斑。雾太厚图就白压了，
  现在最浓的地方也只到 0.32。
- **`--dsw-alias-bg-base`** 保持 `transparent`，别贪方便改成半透明——它会被套娃叠加。
- **`body` 的 `background-color`** 才是那层纱，`rgba(251, 242, 236, 0.55)`。
  **这个数就是「图有多明显」的唯一旋钮**：想淡往 0.7 调，想清楚往 0.4 调，
  调它不会因为层数变化而失真。深色那句同理（`rgba(23, 19, 28, 0.94)`）。

## 关掉它

从 `profiles/desktop/package.json` 的 `dsh.profile.bundles` 里删掉 `dsh-theme-elysia`
这一行，重启应用即可恢复官方配色（`dependencies` 里的 link 可以留着不碍事）。

## 注意

同一个界面**只装一个换肤插件**：所有这类插件都在改同一批 `--dsw-*` 变量，
装两个就是互相打架，谁后加载谁赢。

## 首页那句招呼（v0.4.0）

新会话首页那行大字本来是 `探索未至之境`（i18n 键 `hero.headline`，字符串在 `app.asar` 里）。
这一版在**页面上**把它换成粉色的「嗨♪爱愿妖精♥」，`app.asar` 一个字没动：

- `client.js` 里 `brandHero()` 找到「整段文本刚好等于原句」的那个空 `span`，清空后塞进
  `<span class="elysia-hero-wordmark">`；打过标记的不会再碰第二次。
- React 重渲染会把原句摆回来，所以挂了个 `MutationObserver`，200ms 至多补一次，
  先做一遍便宜的文本判断再决定要不要扫 `span`。
- 样子在 `lib/elysia.css` 末尾：粉渐变 + `background-clip: text` + 7s 流光，
  深色主题另给一套更亮的粉；`prefers-reduced-motion` 下停掉动画。
- 中英文界面都认（`探索未至之境` / `Into the Unknown`）。

要改字，改 `client.js` 的 `HERO_NEW` 一个常量就够，然后**完全退出再打开桌面端**——
样式和脚本都是启动时读的，刷页面不一定轮得到。

## 标题旁边那块牌子（v0.5.0）

原来标题左边那条游泳的小鱼，现在换成了抠好底的小爱头像。走的是宿主正经留的槽，不是改 DOM：

- 宿主在首屏渲染 `renderSlot("conversation.hero.brand.mark", { size: 34, className: <fish 类> },
  { fallback: HeroFish })` —— `kind: single`、`scope: root`，没有注册参数。
  `client.js` 里 `slots.inject('conversation.hero.brand.mark', …)` 注册一个 `<img>` 进去就顶掉了 fallback。
- 图是 `lib/elysia-mark.png`（102×88，透明底），由宿主新加的 `GET /api/elysia-theme/mark` 直出；
  客户端 `<img src>` 指过去，取不到就自己从 DOM 里退场，宁可空着也不留破图标。
- 宿主给的 `className` 是它自己那条小鱼的类，所以它那套「悬停摆尾」的 keyframes 照样作用到这张脸上；
  我们自己只加了粉色的 `drop-shadow`、悬停时轻轻歪一下（`prefers-reduced-motion` 下全停）。
- 尺寸按宿主的 `size`（34）放大 14% —— 这张脸比鲸鱼细，等比缩到 34 会看不清眼睛；39px 不会把那一行撑开。

**这张图是怎么抠的**：原图是黑底 JPEG（透明被压成纯黑）。`D:\AI\JARVIS\temp\cut_black.py`
从四条边泛洪、只吃掉「暗到 max(r,g,b) ≤ 26」且与边缘连通的像素（角色是深紫描边，不是纯黑，
所以肚子里那块黑吃不到）；紧挨透明区的暗像素给一档半透明羽化；最后转 `RGBa` 预乘再缩，
否则缩小时透明处的黑会渗进边缘、糊成一圈毛边。换图重跑这个脚本就行。
