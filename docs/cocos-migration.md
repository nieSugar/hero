# Cocos Creator 迁移说明

当前项目主框架已从 Godot 迁移到 Cocos Creator 3.8 LTS，场景入口是 `assets/scripts/AuraSurvivorGame.ts`。

入口组件只负责 Cocos 生命周期和模块协调；玩法状态、渲染、输入、存档/音频与自检分别位于 `AuraSurvivorSession.ts`、`AuraSurvivorRenderer.ts`、`AuraSurvivorInput.ts`、`AuraSurvivorPlatform.ts` 和 `AuraSurvivorChecks.ts`，共享类型与配置位于 `AuraSurvivorModel.ts`。

## 打开项目

1. 用 Cocos Creator 3.8.x 打开项目根目录。
2. 打开 `assets/Game.scene`。
3. 点击预览运行。

如果预览后只看到一块灰色画布和 FPS 面板，说明当前跑的是 Cocos 空场景，不是游戏场景。先双击 `assets/Game.scene`，确认层级里有 `Canvas` 和 `Camera`，再点击预览。Creator 已经打开过这个项目但没有看到 `Game.scene` 时，先关闭项目再重新打开，让 asset-db 重新扫描资源。

## 当前迁移范围

- 已迁移：主菜单、玩家移动、怪物追击、光环伤害、经验球、升级三选一、暂停、结算、阶段波次、精英奖励、威胁等级、固定种子挑战、本地纪录、程序化地图绘制和 Cocos 启动场景。
- 已接入：`assets/resources/sprites/` 下像素贴图，运行时通过 `resources.load` 切成 `SpriteFrame`，用于玩家、怪物和经验球；导入配置使用 `nearest` 与 `clamp`。
- 已接入：`assets/resources/audio/` 下受伤、击杀、拾取/升级、Boss 四组 SFX 和循环 BGM，并保存声音开关。
- 已适配：横屏 HUD、左侧单摇杆、Touch 选卡/按钮、safe area、切后台自动暂停，以及震屏和减少动态效果设置。
- 已移除：Godot 项目配置、场景、GDScript 和 `.import` 文件。

## 平台与工具链边界

- 原生 Simulator 可用于当前玩法与界面验收。
- Web 预览仍受本机 Cocos 3.8.8 custom pipeline Effect 数据异常影响；这是安装 / 预览环境问题，不代表玩法逻辑失败。
- `build-config/android.json` 已启用左右横屏并关闭竖屏，生成原生工程时对应 `sensorLandscape`。命令行构建可在项目根目录使用：`"<CocosCreator.exe>" --project "E:\github\halo" --build "configPath=./build-config/android.json"`。
- 本轮未产出 APK；发布前仍需做一次真机输入、safe area、音频和切后台验收。

`AuraSurvivorGame` 继续作为场景中唯一挂载的入口组件，原 `.meta` UUID 与场景引用保持不变。内部按状态、呈现和平台边界拆分，但不引入 ECS、DI 容器或 Player/Enemy 一对象一类的文件大爆炸。
