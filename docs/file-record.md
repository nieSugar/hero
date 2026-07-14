# 文件记录

这个文件记录《光环生存》项目内的重要文件、用途和维护状态。新增文件时优先补这里，别让项目目录变成无人区。

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| `docs/project-proposal.md` | 《光环生存》游戏立项书原文 | 已创建 |
| `docs/gdd-v1.md` | 《光环生存》GDD V1.0 原文 | 已创建 |
| `docs/project-memory.md` | 项目长期记忆，记录立项书、GDD、MVP 范围和开发原则 | 已创建 |
| `docs/file-record.md` | 项目文件清单和维护记录 | 已创建 |
| `docs/cocos-migration.md` | Cocos Creator 迁移说明和打开项目步骤 | 已创建 |
| `docs/player-experience-roadmap.md` | 玩家体验审查、阶段 A～D 实施计划与验收记录 | 已创建 |
| `package.json` | Cocos Creator 项目标识和版本信息 | 已创建 |
| `tsconfig.json` | Cocos Creator TypeScript 配置入口 | 已创建 |
| `settings/v2/packages/scene.json` | Cocos Creator 当前启动场景配置 | 已创建 |
| `build-config/android.json` | Android 构建配置：启用左右横屏、关闭竖屏，生成 `sensorLandscape` | 已创建 |
| `assets/Game.scene` | Cocos Creator 启动场景，挂载 `AuraSurvivorGame` 主组件 | 已创建 |
| `assets/scripts/AuraSurvivorGame.ts` | Cocos 场景入口：生命周期、模块装配、模式协调 | 已重构 |
| `assets/scripts/AuraSurvivorModel.ts` | 纯 TypeScript 领域类型、数值与敌人/阶段/升级配置 | 已创建 |
| `assets/scripts/AuraSurvivorSession.ts` | 唯一局内状态所有者：模拟、战斗、刷怪、成长与地形规则 | 已创建 |
| `assets/scripts/AuraSurvivorRenderer.ts` | Cocos Graphics/Sprite/Label 绘制、布局与 UI 命中 | 已创建 |
| `assets/scripts/AuraSurvivorInput.ts` | 键鼠与 Touch 输入归一化、单摇杆状态 | 已创建 |
| `assets/scripts/AuraSurvivorPlatform.ts` | 本地纪录存储与 BGM/SFX 播放 | 已创建 |
| `assets/scripts/AuraSurvivorChecks.ts` | 独立测试 Session 的最小规则与行为自检 | 已创建 |
| `assets/resources/audio.meta` | Cocos 音频资源目录元数据 | 已创建 |
| `assets/resources/audio/` | 受伤、击杀、拾取/升级、Boss 四组 SFX 与循环 BGM | 已接入 |
| `assets/resources/audio/*.wav.meta` | 五个 WAV 音频的 Cocos 导入元数据 | 已创建 |
| `assets/resources/sprites/aura_survivor_atlas.png` | Demo 像素风贴图表：怪物、经验晶体、地砖 | 已接入 |
| `assets/resources/sprites/player_aura_sheet.png` | 无武器光环行者四方向角色贴图 | 已接入 |
| `assets/resources/sprites/*.png.meta` | 像素贴图的 Cocos 导入元数据，使用 `nearest` 与 `clamp` | 已更新 |

## 记录规则

- 新增场景、脚本、配置、资源目录时，在上表补一行。
- 临时实验文件不要进记录，确认会保留再写。
- 删除或重命名文件时，同步更新这里。


