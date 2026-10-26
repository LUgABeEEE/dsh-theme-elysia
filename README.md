# dsh-theme-elysia ·「乐土礼堂」· web profile 适配版

给 **DeepSeek Harness（DSH）Web GUI** 换一身樱粉配色的界面主题 —— 原包是给桌面端（Electron / `profile=desktop`）写的，这一份是 **SER8 上 `profile=web` 的自用适配**。

> 版本 `0.5.0-web.1` ｜ 原作者：爱莉希雅（粉色妖精小姐♪）的舰长 ｜ 代码 MIT，素材版权见文末
> 适配改动：`lib/index.js` 去掉 Windows 专用逻辑、样式改走 `webserver/index-inject`；`package.json` 的 `dsh.client.inject` 换成本机真实存在的包名。**配色、底图、旋钮逻辑一行没动。**

---

## 和原包的区别（为什么不能直接塞进 web）

| 位置 | 原包（桌面端） | 本适配版（web） |
|---|---|---|
| 样式注入 | `webserver/index-inject`（桌面 IPC）+ `tapIndex` 兜底 | 只走 `webserver/index-inject`，`tapIndex` 保留为兜底并自动去重 |
| 端口文件 | 把端口写进 `D:\AI\JARVIS\tasks\dsh-port.txt`（给 QQ 桥用） | **整段删除**（Linux 上这路径会被当成相对目录建出来） |
| 配置/底图目录 | `%USERPROFILE%\.dsh\elysia-theme` | `os.homedir()/.dsh/elysia-theme` ⇒ `/data/agent/.dsh/elysia-theme` |
| 写接口防护 | 无 | 加了同源校验：带其它 `Origin` 的 POST/DELETE 一律 403 |
| `dsh.client.inject` | `@deepseek-ai/dsh-client-runtime`（0.2.x 已无此包） | `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-slots` |

契约核对（DSH `0.2.1-rc.2`）：`settings.section` 是 list 槽、`label` 支持字符串；`conversation.hero.brand.mark` 的 owner props 正是 `{ size, className }`；`--dsw-static-*` / `--dsw-alias-*` 色阶与 `data-ds-dark-theme` 属性都还在。

---

## 安装（本机 SER8，一次性）

```bash
# 1) 包放到插件目录
cp -r dsh-theme-elysia /data/agent/.dsh/plugins/dsh-theme-elysia

# 2) 改 profile（先备份！）
cp /data/agent/.dsh/profiles/web/package.json /data/agent/.dsh/profiles/web/package.json.bak
```

`/data/agent/.dsh/profiles/web/package.json` 里加两处：

```jsonc
"dependencies": {
  // …
  "dsh-theme-elysia": "link:/data/agent/.dsh/plugins/dsh-theme-elysia"
},
"dsh": {
  "profile": {
    "bundles": [
      // …
      "dsh-theme-elysia"
    ]
  }
}
```

```bash
# 3) 装链接（本地 link，不联网）
cd /data/agent/.dsh/profiles/web && pnpm install

# 4) 重启 dsh-web，刷新页面
```

装完应该看到：大理石礼堂底图 + 樱粉界面；新会话首页那句「探索未至之境」变成粉色的「嗨♪爱愿妖精♥」，标题旁的小鱼换成小爱头像；设置里多出「乐土礼堂」一页。

---

## 卸载 / 回滚

```bash
cp /data/agent/.dsh/profiles/web/package.json.bak /data/agent/.dsh/profiles/web/package.json
cd /data/agent/.dsh/profiles/web && pnpm install
# 重启 dsh-web
```

只想暂时关掉：从 `dsh.profile.bundles` 里删掉 `"dsh-theme-elysia"` 再重启，`dependencies` 那行留着不碍事。

---

## 旋钮

设置 → **乐土礼堂**：背景透明度、放大、晃动强度（0 = 不晃）、晃动速度；以及底图图库（自带一张 + 自己上传的 webp/png/jpg/avif，单张 12MB 内）。

- 旋钮改完**立刻生效**，不用刷新；换底图要刷一次页面。
- 配置落盘在 `/data/agent/.dsh/elysia-theme/config.json`，自己传的图在 `…/elysia-theme/bg/`。重装插件不会丢。
- ⚠️ 同一个界面**只装一个换肤插件**，装两个会互相打架，谁后加载谁赢。

---

## 已知限制

- **只在 `0.2.1-rc.2` 上适配过**。`package.json` 里 `engines.dsh` 写成 `>=0.2.0-rc.1 <0.3.0`，但升级到新版本后 `--dsw-*` token 或槽名有变动的话，可能要重新对一遍。
- 深色模式走的是 CSS 里那套「夜樱花」色阶，不挂大厅照片（也就没有晃动轨迹）—— 原包就是这么设计的。
- 首页招呼靠 `MutationObserver` 扫文本节点替换，属于「不改安装包就能换字」的权宜做法；宿主换文案就得跟着改 `HERO_OLD`。

---

## 自检脚本

```bash
node tests/smoke.mjs        # 服务端：注入表、路由、同源校验（用假 HOME，不碰真实配置）
node tests/client-smoke.mjs # 浏览器半端：自注册、槽登记、样式标签
```

---

## 版权

- **代码**：MIT（原作者声明），本适配版同样 MIT。
- **画面素材**：礼堂大厅照片、小爱头像、以及界面里出现的所有角色美术，版权归 **米哈游 /《崩坏3》** 所有。粉丝作品，**免费分发、不可商用**。
- 本目录是**个人自用适配**，作者授权尚在沟通中；未经原作者同意不对外发布。
