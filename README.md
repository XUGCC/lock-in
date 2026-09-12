<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="LOCK IN：手机里的 Locking 练习日历，把每一次练习压进日历与黑胶唱片">
</p>

<p align="center">
  <a href="#-构建-apk"><img alt="Android 6.0+" src="https://img.shields.io/badge/Android-6.0%2B-30449E?logo=android&logoColor=FFF9EB"></a>
  <img alt="Capacitor 7" src="https://img.shields.io/badge/Capacitor-7-171714?logo=capacitor&logoColor=FFF9EB">
  <img alt="local first, offline ok" src="https://img.shields.io/badge/local_first-offline_ok-E5482F">
  <img alt="no backend, no account" src="https://img.shields.io/badge/no_backend-no_account-716C62">
</p>

**LOCK IN** 是为 Locking 舞者设计的练习打卡 Android 应用。每次练完，记下动作、时长、身体状态、笔记、今天最喜欢的一首歌和一张照片，App 会把它们压进一本可以持续回看的月历与练习轨迹。

- **练习打卡**：Lock、Point、Wrist Roll、Scooby Doo、Stop & Go、Groove、Freestyle，也可以添加自己的练习元素；保存时长、身体状态（Body Energy）和笔记。
- **月历与轨迹**：按月查看练习次数、分钟数、连续天数和音乐天数，点任意日期回看当天记录。
- **今日最爱**：粘贴网易云音乐分享链接，自动识别歌名、歌手和封面；识别失败时可以手动填写。
- **练习相册**：App 内拍照或从手机相册选图，网格浏览、全屏预览、另存到系统相册、删除。
- **记录管理**：按动作筛选、编辑、删除历史记录。
- **数据备份**：一键导出 / 导入 JSON。

## 一次练习，如何变成一枚日历唱片

<p align="center">
  <img src="./assets/readme/practice-flow.svg" width="100%" alt="练习输入保存在手机本地，再生成月历、连续天数与练习轨迹，并可导出 JSON 备份">
</p>

App 没有后端和账号系统。练习记录、自定义元素、每日歌曲与相册元数据全部保存在手机本地；日历、统计和练习轨迹由这些数据即时生成，断网也不影响打卡。

## 数据与隐私

- 练习记录只保存在 App 本地（`localStorage`），不会上传到任何服务器，也不会同步到其他设备。
- 相册照片本体保存在 **App 私有目录**，卸载 App 会一并删除；「存到相册」会向系统相册另存一份副本，该副本不受卸载影响。
- 自动识别歌曲时，歌曲 ID 会发送到公开的 Meting 解析服务；网易云短链接会先通过 Unshorten.me 取得最终歌曲地址。App 不读取网易云账号、歌单或听歌历史。
- 外部识别服务不可用时，仍可手动填写歌名、歌手和 BPM，并使用本地默认封面。
- **卸载前请先导出 JSON 备份**（主页底部 `⇩ JSON`），恢复时使用 `⇧ JSON`。

## 安装

目前通过自行构建获得 APK（发布 Release 后可直接从 [GitHub Releases](https://github.com/XUGCC/lock-in/releases) 下载）：

```bash
git clone https://github.com/XUGCC/lock-in.git
cd lock-in
npm install
npm run android:release
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

把 APK 传到手机上安装；首次安装第三方 APK 需要允许「安装未知来源应用」。

## ▦ 构建 APK

环境要求：

- Node.js LTS
- JDK 17 及以上（Capacitor 7 按 Java 21 编译，推荐 JDK 21）
- Android SDK（minSdk 23 / targetSdk 35 / build-tools），通过 `ANDROID_HOME` 或 `android/local.properties` 指定

```bash
# 首次
npm install
npx cap sync android

# 修改 www/ 后同步到 Android 工程
npx cap sync android

# 命令行构建 Debug APK（无需打开 Android Studio）
cd android
gradlew.bat assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

签名版走 `npm run android:release`，读取 `android/key.properties` 指向的 release keystore。`key.properties`、`*.jks` 与 `android/app/build/` 均已加入 `.gitignore`，签名材料不入库、需自行备份。

也可以用 Android Studio 打开 `android/` 目录直接 Run（`npm run android:open`）。

## ● 项目结构

```text
lock-in/
├── assets/readme/          # README 视觉素材（hero / 流程图）
├── www/                    # WebView 界面源码（Capacitor webDir）
│   ├── index.html
│   ├── styles.css
│   ├── app.js              # 练习打卡 + 相册业务逻辑
│   ├── lock-in-icon.png
│   ├── default-album-cover.webp
│   └── fonts/  vendor/
├── android/                # Capacitor Android 原生工程
│   └── app/src/main/java/com/xugcc/lockin/
│       └── MediaStoreSaverPlugin.java   # 自定义插件：把照片写入系统相册
├── capacitor.config.ts     # appId com.xugcc.lockin
├── package.json            # Capacitor 依赖与 npm 脚本
└── 纯AndroidApp改造蓝图.md  # 从 PWA 转向纯 Android App 的设计记录
```

前端是原生 HTML、CSS 和 JavaScript，没有框架和构建步骤；`www/` 整体作为 WebView 资源打包进 APK。

---

<p align="center">
  <em>KEEP THE GROOVE. OWN THE DATA.</em>
</p>
