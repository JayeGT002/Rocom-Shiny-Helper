# Rocom Shiny Helper 工作流程

## 项目范围

- 本仓库只保存网站页面、赛季数据、图片和维护脚本。
- 修改前先运行 `git status --short`，保留已有改动，不用 Git 命令恢复或覆盖文件。
- `Rocom-wiki-data` 是独立仓库。需要查询其中资料时只读取必要内容，不复制其数据文件到本仓库。

## 更新赛季

1. 查看 `data/seasons.json`、最近赛季的 `data/S*.json`、`data/pool_availability.json`、`data/high_value_sprites.json` 和图片目录。
2. 在 `data/seasons.json` 开头加入新赛季。主页面以第一项作为默认赛季；其他有赛季选择器的页面也要检查默认值。
3. 在 `data/SN.json` 记录赛季名称、赛季奇遇、常驻异色、属性和分组。赛季奇遇只记录初始形态；用户提供的处理图片中，左侧精灵代表初始形态。不要把进化形态当作独立初始精灵。
   - 核对进化家族和初始形态时，可以使用相邻的 `Rocom-wiki-data` 工具查询进化链；只把核对结果录入本网站，不复制该仓库的数据文件。
4. 为每只精灵准备同名主立绘；需要头像的页面使用 `images/SN/avatars/`。检查数据名称、图片名称和页面路径一致。
5. 更新蛋组页面覆盖范围和各页面的赛季标题、默认选择器。检查代码里是否仍有旧赛季数量或写死的赛季编号。

## 推荐属性与定向判断

- `js/app.js` 根据当前赛季精灵的属性池和赛季机制计算定向状态。
- 只有当前属性池或赛季机制命中所选精灵且没有命中其他当前赛季精灵时，才显示为可定向。
- 推荐列表排除所选精灵、其阶段和形态；排除本赛季常驻异色精灵及其阶段和形态。
- 修改这套逻辑后，至少核对一个可定向案例、一个不可定向案例、一个与所选精灵同名的高星光值精灵，以及一个本赛季常驻异色家族。

## 混池可用性

- `data/pool_availability.json` 逐赛季人工记录混池状态和原因。新增赛季时逐条确认捕捉方式、当季精灵属性和季节返场情况，不根据前一赛季状态直接推定。
- 精灵属性会让混池失效时，在 `remark` 说明对应精灵和属性。无法通过捕捉目标精灵进入混池时，明确记录该限制。
- `notes` 保留用户指定的原文。混池卡片使用高星光值头像路径 `images/high_value/avatars/{名称}.webp`。

## 图片来源与压缩

- 赛季奇遇图片使用用户提供并命名的素材；常驻异色与混池精灵图片从官方创作者素材库或 BWiki 获取。
- 使用 BWiki 图片时，通过 MediaWiki API 查询图片信息，并带浏览器 `User-Agent`、`Accept`、`Accept-Language` 和 `Referer` 请求头。
- 只取所需初始形态立绘。主立绘保存为 512×512 WebP，头像保存为 256×256 WebP。
- 使用 Pillow 的 WebP `quality=95`、`method=2`、`alpha_quality=100`、`exact=True`。处理文件先放入被 Git 忽略的 `.asset-stage/`，核对文件数量、格式、尺寸、透明通道和项目引用后，再复制到正式图片目录。
- 压缩完成后核对压缩前后的总字节数；若个别已压缩图片变大，记录原因并保留清晰度合适的结果。

## 版本和更新日志

- `data/releases.json` 保存版本、日期、标题和完整更新条目；`pages/changelog.html` 从该文件读取最新条目，旧版本记录继续保留在页面中。
- 使用 `node scripts/update-version.mjs --title "标题" --note "更新内容"` 增加版本。脚本默认增加补丁号；使用 `--level minor` 增加次版本，使用 `--level major` 增加主版本。每项更新单独添加一个 `--note`，完整记录用户可见变化和数据变动。
- 新赛季主线按主版本号更新；新增独立页面或主要功能按次版本号更新；修复、数据修订和图片调整按补丁号更新。
- 先完成数据、代码和图片，再整理更新条目。用 `--dry-run` 检查版本号与更新内容，确认后去掉该参数写入。
- Git 提交说明沿用仓库已有格式，并在末尾写入版本号，例如 `feat: S5 圣龙宝藏上线 v5.0.0`。

## 验证

- 解析所有数据文件：`for file in data/*.json; do python3 -m json.tool "$file" >/dev/null || exit 1; done`
- 检查 JavaScript 语法：`node --check js/app.js`、`node --check js/changelog.js`、`node --check scripts/update-version.mjs`。
- 检查改动空白：`git diff --check`；暂存后再运行 `git diff --cached --check`。
- 页面行为有变化时，用本地 HTTP 服务器打开对应页面，核对页面实际显示和图片请求状态。

## 提交与推送

- 推送前检查 `git status --short`、`git diff --check` 和 `git diff --cached --name-only`。
- 只暂存本网站需要的页面、数据、图片和维护文件。不要使用 `git add -A`，不要把独立资料仓库的文件加入提交。
- 仅在用户明确要求时提交或推送。推送前确认仓库根目录、目标分支和暂存文件清单。
