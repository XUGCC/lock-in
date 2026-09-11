# LOCK IN — 纯 Android App 改造蓝图

> 状态：**规划稿（仅记录方向，尚未动工）**
> 记录时间：2026-09-10

---

## 0. 决策结论（本轮拍板）

| 事项 | 决定 |
| --- | --- |
| 平台定位 | **彻底去掉网页版 / PWA 身份，LOCK IN 以后只做 Android App** |
| 现有前端代码 | 保留 `www/` 作为 WebView 里的界面源码（不再改回 PWA 属性） |
| 新增「相册」页面 | **独立页面**，与「练习打卡记录」分开，练习记录仍是文字 |
| 相册内容范围 | **只做照片，不做视频**（视频后续另议） |

核心理解：

```
www/（界面源码）  ──在 WebView 里运行──▶  Android App（唯一目标形态）
    │
    不再提供浏览器可直接安装的 PWA
    不再需要 manifest / service worker / 安装引导
```

---

## 1. 目标：拍照 + 相册的存储方案（已与你确认）

照片本体存在**手机 App 私有目录**，localStorage 只存路径文字；三者关系如下：

| 位置 | 说明 | 卸载 App 后 |
| --- | --- | --- |
| **App 私有文件夹**（`files/`） | 照片本体居住地，只有本 App 能访问 | 删除 |
| **系统相册** | 照片"另存一份"到相册，用户 + 所有 App 可见 | 保留 |
| **localStorage** | 只存路径字符串 + 元数据（几十字节） | 删除 |

### 三条操作（你的设计，全部可实现且无需''下载'，照片本机已有）

1. **App 内拍照** → 只存 App 私有目录（相册看不见）
   - 用 `@capacitor/camera`，`saveToGallery: false`
2. **保存到相册** → 一步"另存一份"到系统相册
   - 用 `Camera` 的 `saveToGallery: true`（或从私有文件再拷一份）
3. **从相册选图上传** → 复制一份进 App 私有目录再显示
   - 推荐：选完**立刻复制进 `files/`**，避免 `content://` 临时授权失效 / 原图被删
   - 现代 Android 相册选择器几乎**无需权限**

---

## 2. 「独立相册」页 UI 蓝图

```
App 顶部导航新增「相册」入口
        │
  相册页（网格缩略图布局）
   ├── 拍照按钮 ────── Camera（存 files/，saveToGallery:false）
   ├── 从相册选图 ──── Photo Pick（复制进 files/）
   └── 每张照片卡片
        ├── 点击 → 全屏预览
        └── 菜单 →「保存到相册」（另存一份）/「删除」
```

### 新增数据层

- 照片本体：App 私有目录 `Directory.Data`（`files/`）
- 元数据：localStorage 新 key，例如 **`lock-in-photos-v1`**
  ```json
  [
    {
      "id": "uuid",
      "path": "photos/2026-09-10-xyz.jpg",
      "caption": "",
      "createdAt": "2026-09-10T12:00:00.000Z"
    }
  ]
  ```
- 与练习记录（`lock-in-local-records-v1`）相互独立，互不影响

---

## 3. 需移除的 PWA 残留（待动工时执行）

当前 `www/` 里保留着 PWA 机制，纯原生后全部删除：

| 位置 | PWA 内容 | 处理 |
| --- | --- | --- |
| `www/manifest.webmanifest` | PWA 清单文件 | 删除文件 |
| `www/sw.js` | Service Worker（离线缓存） | 删除文件 |
| `www/index.html` L7 | `<link rel="manifest" ...>` | 删除 |
| `www/index.html` L10 | `<link rel="apple-touch-icon" ...>` | 删除 |
| `www/app.js` L27-39 | `isNativeApp()` / `NATIVE_APP` / `native-app` 类 | 删除（纯原生无需判断） |
| `www/app.js` L83 | `deferredInstallPrompt` 变量 | 删除 |
| `www/app.js` L1383-1407 | `beforeinstallprompt` + 安装按钮逻辑 | 删除 |
| `www/app.js` L1429-1430 | `navigator.serviceWorker.register(...)` | 删除 |
| `www/styles.css` L45/47/309 | `.install-button` 相关样式 | 删除 |

---

## 4. 新增原生依赖（待做）

```
npm install @capacitor/camera @capacitor/filesystem
npx cap sync android
```

| 能力 | 插件 |
| --- | --- |
| App 内拍照（存私有目录） | `@capacitor/camera` |
| 系统相册选图（复制进 App） | `@capacitor/camera` |
| 保存到系统相册 | `@capacitor/camera`（`saveToGallery`） |
| 文件读写 + 预览 URL | `@capacitor/filesystem` + `Capacitor.convertFileSrc()` |

> 提示：`convertFileSrc()` 必须用于本地文件路径，否则 WebView 拒绝加载 `file://`。

---

## 5. 其他注意事项

1. **权限**：App 内拍照需在 `AndroidManifest.xml` 声明摄像头权限；相册选择器（Android 13+）通常无需存储权限（由系统 Photo Picker 处理）。
2. **原图过大**：缩略图需处理（原图可能几 MB，列表加载会卡）。
3. **数据安全**：照片在 App 私有目录，卸载即删除；需要时再做「导出 zip」/备份。
4. **本项目 `.idea/` 已被 gitignore**，Android Studio 本地配置不入库。
5. **编码提示**：PowerShell 读取中文文件会显示乱码，这是**控制台编码显示问题**，文件本身是正常 UTF-8（已用 read 工具核实）。

---

## 6. 下一步（等你示意开工）

1. 安装 `@capacitor/camera` + `@capacitor/filesystem`
2. 清理 PWA 残留（第 3 节清单）
3. 新建「相册」页（拍照 / 相册选图 / 保存到相册 / 预览删除）
4. 数据层：私有目录 + `lock-in-photos-v1`
5. `npx cap sync android` → Run 到真机验证