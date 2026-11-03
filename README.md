# dsh-plugin-athand

手边 AtHand 的 DSH 插件：把剪贴板历史、图片记录和快捷短语接进 DSH Web UI，支持侧栏面板、搜索、一键插入输入框和跨应用文本监听。

> 这个仓库只包含 DSH 侧代码。剪贴板采集、SQLite 存储和原生悬浮窗都在 AtHand 原生端（macOS）；插件通过本机的 `bridge.json` 找到原生服务，经 `127.0.0.1` 认证接口读写，不直接打开数据库，也拿不到原生 token。

## 依赖

- **DSH 0.2.1-rc.5 或更新版本**（含 0.2.1 正式版及后续；桌面端或自行运行的 `dsh web`）；
- **AtHand 原生端（macOS）**。未运行时插件仍可浏览本地缓存，新增、删除、置顶、清空和设置修改会进入待同步队列，原生端恢复后按顺序重放。

## 安装

在 DSH 桌面端打开 **设置 → 插件**，搜索 `dsh-plugin-athand` 安装，刷新页面即可看到侧栏入口。

命令行安装：

```sh
dsh plugin --profile desktop add dsh-plugin-athand
```

> 尚未发布到 npm 时，上面的搜索和 `add` 都取不到包，请用下面的本地目录方式安装。

本地开发时，在 profile 的 `package.json` 里指向工作目录，再重新安装依赖：

```json
{
  "dependencies": {
    "dsh-plugin-athand": "link:/path/to/athand-dsh-plugin"
  }
}
```

Host 侧改动需要重启 DSH 进程；只改 `dsh-plugin/client.js` 可以由 HMR 直接更新。

## 功能

- 侧栏剪贴板面板：文本与图片历史、搜索、图片放大预览；
- 选中条目一键插入当前输入框，或复制回系统剪贴板；
- 快捷短语：新建、编辑、导入导出 JSON；
- 跨应用文本监听开关（由原生端执行采集）；
- 原生端离线时使用本地快照与操作队列，恢复后按序重放；
- 中英文界面文案。

## 数据与隐私

- 浏览器只访问同源的 `/api/athand/*`，Host 代理补上原生端的 Bearer token，token 不进入前端；
- 原生端是唯一写入方，插件从不直接写 SQLite；
- 插件在浏览器侧只保存缓存快照和离线队列（`localStorage`，队列最多 200 条）；
- 原生数据目录：macOS 为 `~/Library/Application Support/AtHand/`，目录 `0700`、数据库文件 `0600`。

## 开发与测试

```sh
node --test dsh-plugin/test/*.test.mjs
```

零运行时依赖，需要 Node.js ≥ 22.5。测试只在进程内运行：不启动原生 App、不写真实剪贴板、不投递键盘事件。

## 目录结构

```text
dsh-plugin/index.js            # Host 入口：注册原生 API 代理
dsh-plugin/client.js           # DSH Web UI、状态与剪贴板逻辑
dsh-plugin/host/api.js         # 会话鉴权 + 同源代理
dsh-plugin/host/native.js      # bridge.json 发现、token、转发、健康检查
dsh-plugin/locale/             # 中英文文案
dsh-plugin/test/               # Host 代理、离线队列测试
dsh-plugin/cordis.patch.yml    # DSH bundle 补丁
```

## 许可证

[MIT](LICENSE)
