# Cocos Creator 迁移说明

当前项目主框架已从 Godot 迁移到 Cocos Creator 3.8 LTS，主逻辑入口是 `assets/scripts/AuraSurvivorGame.ts`。

## 打开项目

1. 用 Cocos Creator 3.8.x 打开项目根目录。
2. 打开 `assets/Game.scene`。
3. 点击预览运行。

如果预览后只看到一块灰色画布和 FPS 面板，说明当前跑的是 Cocos 空场景，不是游戏场景。先双击 `assets/Game.scene`，确认层级里有 `Canvas` 和 `Camera`，再点击预览。Creator 已经打开过这个项目但没有看到 `Game.scene` 时，先关闭项目再重新打开，让 asset-db 重新扫描资源。

## 当前迁移范围

- 已迁移：主菜单、玩家移动、怪物追击、光环伤害、经验球、升级三选一、暂停、结算、程序化地图绘制和 Cocos 启动场景。
- 已接入：`assets/resources/sprites/` 下像素贴图，运行时通过 `resources.load` 切成 `SpriteFrame`，用于玩家、怪物和经验球。
- 已移除：Godot 项目配置、场景、GDScript 和 `.import` 文件。

## 后续建议

先跑通 `AuraSurvivorGame` 单组件版本，再拆 Player、Enemy、Spawner、UI。现在就拆模块属于给自己找活儿，核心循环还没在 Cocos 里验证，别急着把代码切成拼图。
