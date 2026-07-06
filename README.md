# 阿布扎比房产数据报告（交互版）

ADREC 双层数据交互报告：**2025 年报宏观 KPI** + **滚动 12 个月成交趋势**。配套「30天看懂阿布房产」小红书系列。

**在线访问：** https://abudhabi-realestate.github.io/abu-market-report/

## 功能

- **Layer 1 · 宏观**：761 亿成交额、买家结构 51/38/11、期房 71%、人口与供需
- **Layer 2 · 近半年**：2025.10—2026.04 共 17,048 套、期房 80.5%、一级市场 76.9%
- **年报 × 近半年对照表**：ADREC 与成交记录关键指标并排
- **附录**：滚动 12 个月（2025.05—2026.04）可展开查看
- **四个数据观察**：数据 + 解读 + 风险提示（非推销话术）
- **统计口径说明**：可折叠，标注两套数据来源差异
- 移动端：sticky 摘要条 + 章节锚点导航

## 本地预览

> 需通过 HTTP 访问（fetch 加载 JSON），勿直接用 `file://` 打开。

```bash
cd github-pages/abu-market-report
npx --yes serve .
# 浏览器打开 http://localhost:3000
```

或 Python：

```bash
python -m http.server 8080
```

## 更新数据

```bash
# 1. 将 ADREC 导出的 CSV 放到本仓库同级或 `data/` 目录（见 tools 脚本说明）
# 2. 重新生成近半年 JSON
node tools/analyze_recent_sales.mjs

# 3. 宏观层（ADREC 年报）手动编辑 data/annual.json
```

## GitHub Pages 部署

1. 在 GitHub 新建仓库 `abu-market-report`
2. 上传本目录全部文件（至少 `index.html`、`data/`、`scripts/`）
3. **Settings → Pages → Deploy from branch → main / (root)**
4. 等待 1～2 分钟访问 `https://<用户名>.github.io/abu-market-report/`

或使用工作区根目录脚本：

```powershell
..\_scripts\setup-github.ps1 push
```

## 目录结构

```
abu-market-report/
├── index.html           # 主页面
├── data/
│   ├── annual.json      # ADREC 2025 年报
│   ├── halfyear.json    # 近半年成交（自动生成）
│   └── rolling12.json   # 滚动 12 个月附录
├── scripts/
│   └── render.js
└── tools/
    ├── analyze_recent_sales.mjs
    └── update_rolling12.py
```

## 关联工具

- [买房成本计算器](https://abudhabi-realestate.github.io/uae-buy-cost-calculator/)
- 区域地图页（规划中）
- Hub 首页：https://abudhabi-realestate.github.io/william-xing-hub/

## 免责声明

估算与解读仅供参考，不构成投资建议。政策、税费、贷款条件请以当地最新法规及专业人士意见为准。
