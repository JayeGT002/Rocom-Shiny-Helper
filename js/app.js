// 全站共享 JS（子页无 #season-select 时自动跳过）
(() => {
  function initMatcher() {
    if (!document.getElementById('season-select')) return;

    // ==================== 配置 ====================
    const BASE_PATH = '.';

    // 属性颜色：从 images/attrs/ 属性图标中提取的主色
    const attrColors = {
      "普通": "#3080B0", "草": "#40B070", "火": "#D05020", "水": "#60A0F0",
      "光": "#40C0F0", "地": "#907030", "冰": "#50A0D0", "龙": "#E04060",
      "电": "#E0C000", "毒": "#B060E0", "虫": "#90C020", "武": "#F09030",
      "翼": "#30C0C0", "萌": "#F070A0", "幽": "#9040E0", "恶": "#C04070",
      "机械": "#40C0A0", "幻": "#90A0F0"
    };

    // ==================== 状态 ====================
    let seasonsConfig = [];
    let currentSeasonData = null;
    let highValueSprites = [];
    let selectedSprites = new Set(); // 单选：最多包含 1 个元素
    // 属性筛选：'' = 全部，否则为单个属性名（单选）
    let selectedAttr = '';
    // 分类方式：mechanism=赛季机制分类（filterGroups），category=赛季奇遇/常驻异色分类（categoryGroups）
    let filterMode = 'mechanism';

    // 分类方式定义（开关按钮展示文案）
    const FILTER_MODES = [
      { key: 'mechanism', label: '赛季机制', groupField: 'group', groupsKey: 'filterGroups' },
      { key: 'category', label: '赛季奇遇/常驻异色', groupField: 'group2', groupsKey: 'categoryGroups' }
    ];

    // 当前分类方式下的分组列表
    function getFilterGroups() {
      const mode = FILTER_MODES.find(m => m.key === filterMode) || FILTER_MODES[0];
      return (currentSeasonData[mode.groupsKey] || currentSeasonData.filterGroups || []);
    }

    // 当前分类方式下精灵所属分组 key
    function getSpriteGroupKey(sprite) {
      const mode = FILTER_MODES.find(m => m.key === filterMode) || FILTER_MODES[0];
      return sprite[mode.groupField] || sprite.group || '';
    }

    // ==================== 初始化 ====================
    async function init() {
      try {
        const seasonsRes = await fetch(`${BASE_PATH}/data/seasons.json`);
        const seasonsData = await seasonsRes.json();
        seasonsConfig = seasonsData.seasons;

        const hvRes = await fetch(`${BASE_PATH}/data/high_value_sprites.json`);
        const hvData = await hvRes.json();
        highValueSprites = hvData.sprites;

        // 异色图清单（常规/异色交替用；未来赛季更新只需补充 data/yise_images.json）
        try {
          const yiseRes = await fetch(`${BASE_PATH}/data/yise_images.json`);
          yiseImages = await yiseRes.json();
        } catch (e) { /* 无清单则不做交替 */ }

        const select = document.getElementById('season-select');
        select.innerHTML = '';
        seasonsConfig.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.id} ${s.name}`;
          select.appendChild(opt);
        });
        select.addEventListener('change', (e) => loadSeason(e.target.value));

        await loadSeason(seasonsConfig[0].id);

        document.getElementById('loading').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
      } catch (err) {
        document.getElementById('loading').textContent = '加载失败：' + err.message;
        console.error(err);
      }
    }

    // ==================== 加载赛季数据 ====================
    async function loadSeason(seasonId) {
      currentSeasonData = null;
      selectedSprites.clear();
      selectedAttr = '';
      filterMode = 'mechanism';

      const res = await fetch(`${BASE_PATH}/data/${seasonId}.json`);
      currentSeasonData = await res.json();

      // 赛季切换后清空交替队列，避免引用已移除的旧图片
      swapItems.length = 0;

      renderModeSwitch();
      renderAttrFilter();
      renderFilters();
      updateResults();
    }

    // ==================== 渲染分类方式开关 ====================
    // 仅当赛季配置了 categoryGroups 时显示开关（前端完全通用）
    function renderModeSwitch() {
      const wrap = document.getElementById('mode-switch');
      const container = document.getElementById('mode-buttons');
      const hasCategory = (currentSeasonData.categoryGroups || []).length > 0;
      if (!hasCategory) {
        wrap.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      wrap.style.display = 'flex';
      container.innerHTML = '';
      FILTER_MODES.forEach(mode => {
        const btn = document.createElement('button');
        btn.className = 'mode-btn' + (mode.key === filterMode ? ' active' : '');
        btn.dataset.mode = mode.key;
        btn.textContent = mode.label;
        btn.addEventListener('click', () => {
          if (filterMode === mode.key) return;
          filterMode = mode.key;
          container.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === filterMode));
          selectedSprites.clear();
          renderFilters();
          updateResults();
        });
        container.appendChild(btn);
      });
    }

    // ==================== 渲染属性筛选开关 ====================
    // 属性选项 = 当前赛季精灵包含的属性（去重，单选）
    function renderAttrFilter() {
      const container = document.getElementById('attr-filter-buttons');
      container.innerHTML = '';

      // 收集赛季内属性
      const attrSet = new Set();
      currentSeasonData.sprites.forEach(s => {
        if (s.attr1) attrSet.add(s.attr1);
        if (s.attr2) attrSet.add(s.attr2);
      });
      // 按属性色值表固定顺序排序，未知属性排最后
      const order = Object.keys(attrColors);
      const attrs = Array.from(attrSet).sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      const makeBtn = (attr, label, isAll) => {
        const btn = document.createElement('button');
        btn.className = 'attr-btn' + (isAll ? ' all' : '') + (attr === selectedAttr ? ' active' : '');
        btn.dataset.attr = attr || 'all';
        if (attr) {
          const color = attrColors[attr] || '#666';
          btn.style.setProperty('--ac', color);
          btn.style.setProperty('--abg', hexToRgba(color, 0.12));
          btn.innerHTML = `<img src="${BASE_PATH}/images/attrs/${encodeURIComponent(attr)}.png" alt="${attr}">${label}`;
        } else {
          btn.textContent = label;
        }
        btn.addEventListener('click', () => {
          if (selectedAttr === attr) return;
          selectedAttr = attr;
          selectedSprites.clear();
          container.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.attr === (attr || 'all')));
          renderFilters();
          updateResults();
        });
        container.appendChild(btn);
      };

      makeBtn('', '全部', true);
      attrs.forEach(a => makeBtn(a, a, false));
    }

    // 同步所有精灵卡片的选中视觉（单选）
    function syncSelectionUI() {
      document.querySelectorAll('.sprite-card').forEach(card => {
        const cb = card.querySelector('input[type="checkbox"]');
        if (!cb) return;
        const on = selectedSprites.has(cb.value);
        cb.checked = on;
        card.classList.toggle('selected', on);
      });
    }

    // 精灵是否可命中某属性（自身属性 或 可定向属性池 包含该属性）
    function canHitAttr(sprite, attr) {
      if (!attr) return true;
      if (sprite.attr1 === attr || sprite.attr2 === attr) return true;
      const d = sprite.directable;
      if (!d) return false;
      return (d.pool || []).includes(attr) || (d.mechanism || []).includes(attr);
    }

    // ==================== 渲染筛选区（完全通用） ====================
    function renderFilters() {
      const grid = document.getElementById('filter-grid');
      const notice = document.getElementById('season-notice');
      const groups = getFilterGroups();

      if (currentSeasonData.description) {
        notice.style.display = 'block';
        notice.classList.remove('open'); // 默认折叠
        const title = currentSeasonData.noticeTitle || `${currentSeasonData.name} 赛季机制`;
        const paras = String(currentSeasonData.description)
          .split(/\n{2,}/)
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => `<p>${t}</p>`)
          .join('');
        notice.innerHTML = `
          <div class="notice-head">
            <span class="notice-title">${title}</span>
            <span class="notice-arrow">▼</span>
          </div>
          <div class="notice-body">${paras}</div>
        `;
        notice.querySelector('.notice-head').addEventListener('click', () => {
          notice.classList.toggle('open');
        });
      } else {
        notice.style.display = 'none';
        notice.innerHTML = '';
      }

      grid.innerHTML = '';
      // 两个分类并列展示（每个分类内一行 3 张卡片）；非两个分类时整行堆叠
      const sideBySide = groups.length === 2;
      grid.style.gridTemplateColumns = sideBySide ? 'repeat(2, minmax(0, 1fr))' : '1fr';

      groups.forEach((group) => {
        const box = document.createElement('div');
        box.className = 'filter-box';
        box.style.background = hexToRgba(group.color, 0.08);
        box.style.borderColor = hexToRgba(group.color, 0.3);

        const boxId = `group-${group.key}-checkboxes`;

        box.innerHTML = `
          <div class="filter-box-header">
            <h3 style="color:${group.color}">${group.name}</h3>
          </div>
          <div class="checkbox-group ${sideBySide ? 'cols-3' : ''}" id="${boxId}"></div>
        `;

        grid.appendChild(box);

        const groupSprites = currentSeasonData.sprites.filter(s => getSpriteGroupKey(s) === group.key);
        const names = [...new Set(groupSprites.map(s => s.name))];
        renderCheckboxGroup(boxId, names, group);
      });
    }

    function renderCheckboxGroup(containerId, names, groupConfig) {
      const container = document.getElementById(containerId);
      container.innerHTML = '';
      const seasonId = currentSeasonData.season;
      const accent = groupConfig.color || '#666';

      names.forEach(name => {
        const sprite = currentSeasonData.sprites.find(s => s.name === name) || {};
        const attrs = [sprite.attr1, sprite.attr2].filter(Boolean);
        const attrsHtml = attrs.map(a => `
          <span class="sprite-attr">
            <img src="${BASE_PATH}/images/attrs/${encodeURIComponent(a)}.png" alt="${a}">
            ${a}
          </span>
        `).join('');

        // 属性筛选：不可命中当前筛选属性的精灵置灰不可选
        const canHit = canHitAttr(sprite, selectedAttr);

        const label = document.createElement('label');
        label.className = 'sprite-card' + (canHit ? '' : ' disabled');
        label.style.setProperty('--accent', accent);
        label.style.setProperty('--accent-bg', hexToRgba(accent, 0.08));

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        checkbox.checked = selectedSprites.has(name);
        if (!canHit) checkbox.disabled = true;
        checkbox.addEventListener('change', (e) => {
          // 单选：选中新精灵时清空其他选择
          if (e.target.checked) {
            selectedSprites.clear();
            selectedSprites.add(name);
          } else {
            selectedSprites.delete(name);
          }
          syncSelectionUI();
          updateResults();
        });

        // 精灵图片：images/S{赛季}/{精灵名}.png；S4 预览版精灵文件名带「（预览版）」
        const imgFile = sprite.previewImage ? `${name}（预览版）` : name;
        const imgSrc = `${BASE_PATH}/images/${seasonId}/${encodeURIComponent(imgFile)}.png`;
        label.innerHTML = `
          <span class="sprite-img-wrap">
            <img class="sprite-img" src="${imgSrc}" alt="${name}" loading="lazy">
          </span>
          <span class="sprite-name">${nameBlock(name)}</span>
          <span class="sprite-attrs">${attrsHtml}</span>
        `;

        // 占位符控制 + 常规/异色图交替（清单驱动，仅 S1~S3 有异色图）
        const wrapEl = label.querySelector('.sprite-img-wrap');
        const imgEl = wrapEl.querySelector('.sprite-img');
        bindPlaceholder(wrapEl, imgEl);
        setupSwap(wrapEl, imgEl, imgSrc, name);

        label.appendChild(checkbox);
        label.classList.toggle('selected', checkbox.checked);
        container.appendChild(label);
      });
    }

    // ==================== 更新结果 ====================
    // 赛季出现规则：notBeforeSeason(Sx 含Sx以前不出现) / notAfterSeason(Sx 含Sx以后不出现)
    function seasonAllowed(s, seasonId) {
      const rank = t => {
        const m = /S(\d+)/.exec(String(t || ''));
        return m ? Number(m[1]) : null;
      };
      const cur = rank(seasonId);
      if (cur == null) return true;
      const nb = rank(s.notBeforeSeason);
      if (nb != null && cur <= nb) return false;
      const na = rank(s.notAfterSeason);
      if (na != null && cur >= na) return false;
      return true;
    }
    function updateResults() {
      const hasSelection = selectedSprites.size > 0;
      const emptyState = document.getElementById('empty-state');
      const recommendSection = document.getElementById('recommend-section');
      const regionHint = document.getElementById('region-hint');
      const hitAttrsBar = document.getElementById('recommend-hit-attrs');

      if (!hasSelection) {
        emptyState.style.display = 'block';
        recommendSection.style.display = 'none';
        regionHint.style.display = 'none';
        hitAttrsBar.innerHTML = '';
        return;
      }

      emptyState.style.display = 'none';
      recommendSection.style.display = 'block';

      // 收集命中属性 + 选中精灵的完整数据
      const hitAttrs = new Set();
      const selectedData = [];

      selectedSprites.forEach(name => {
        const matches = currentSeasonData.sprites.filter(s => s.name === name);
        matches.forEach(s => {
          selectedData.push(s);
          if (s.attr1) hitAttrs.add(s.attr1);
          if (s.attr2) hitAttrs.add(s.attr2);
        });
      });

      // 命中属性：并入推荐属性池区块顶部
      const attrList = Array.from(hitAttrs).map(attr => {
        const color = attrColors[attr] || '#666';
        return `<span class="attr-tag" style="background:${hexToRgba(color, 0.12)};border-color:${color};color:${color};">
          <img src="${BASE_PATH}/images/attrs/${encodeURIComponent(attr)}.png" alt="${attr}">${attr}
        </span>`;
      }).join('');
      hitAttrsBar.innerHTML = `<span class="label">命中属性：</span>${attrList || '<span style="color:#999;font-size:13px;">无</span>'}`;

      // 地区形态提示（如刺轮砣双形态为相互独立的精灵）
      renderRegionHint(selectedData);

      // 可定向信息：选中精灵可经「属性池」直接定向的属性 / 可经「赛季机制」近似定向的属性
      // （并入推荐属性池：在各属性池分组头用 tag 标注，不再单独列区块）
      const poolAttrs = new Set();
      const mechAttrs = new Set();
      let mechTag = null; // 赛季机制分组的标识（如 S4 金月/赤月），嵌在「赛季机制定向」tag 内
      selectedData.forEach(s => {
        const d = s.directable;
        if (!d) return;
        (d.pool || []).forEach(a => poolAttrs.add(a));
        if ((d.mechanism || []).length > 0) {
          (d.mechanism).forEach(a => mechAttrs.add(a));
          if (!mechTag) {
            const g = (currentSeasonData.filterGroups || []).find(g => g.key === s.group);
            if (g) mechTag = { text: g.badgeText || g.name, color: g.badgeColor || g.color };
          }
        }
      });

      const recommend = highValueSprites
        .filter(s => hitAttrs.has(s.attr))
        .filter(s => !selectedAttr || s.attr === selectedAttr)
        .filter(s => seasonAllowed(s, currentSeasonData.season))
        .sort((a, b) => b.value - a.value);

      const grouped = {};
      recommend.forEach(item => {
        if (!grouped[item.attr]) grouped[item.attr] = [];
        grouped[item.attr].push(item);
      });

      renderRecommend(grouped, poolAttrs, mechAttrs, mechTag);
    }

    // ==================== 渲染地区形态提示 ====================
    // 拥有 family 字段的精灵（如刺轮砣的上弦/下弦形态）为同一精灵的地区形态，
    // 属于相互独立的精灵，需特殊方式刷取（具体方式待补充）。选中其一后提示相关形态。
    function renderRegionHint(selectedData) {
      const el = document.getElementById('region-hint');
      const famSprite = selectedData.find(s => s.family);
      const siblings = famSprite
        ? currentSeasonData.sprites.filter(s => s.family === famSprite.family && s.name !== famSprite.name)
        : [];

      if (!famSprite || siblings.length === 0) {
        el.style.display = 'none';
        return;
      }

      const siblingNames = siblings.map(s => s.name).join('、');
      el.innerHTML = `
        <span class="region-hint-title">地区形态提示</span>
        <span>${famSprite.name} 与 ${siblingNames} 为「${famSprite.family}」的地区形态，属于相互独立的精灵，需特殊方式刷取。</span>
      `;
      el.style.display = 'flex';
    }

    // ==================== 渲染推荐列表 ====================
    function renderRecommend(grouped, poolAttrs, mechAttrs, mechTag) {
      const container = document.getElementById('recommend-list');
      container.innerHTML = '';

      const attrs = Object.keys(grouped).sort();

      if (attrs.length === 0) {
        container.innerHTML = '<div style="color:#999;font-size:13px;text-align:center;padding:12px;">暂无匹配推荐</div>';
        return;
      }

      // 可定向（属性池/赛季机制可定向）属性池优先展示，其余平铺并标「不可定向」；不再折叠
      const directableGroups = [];
      const nonDirectableGroups = [];

      attrs.forEach(attr => {
        if (poolAttrs.has(attr) || mechAttrs.has(attr)) {
          directableGroups.push(attr);
        } else {
          nonDirectableGroups.push(attr);
        }
      });

      directableGroups.forEach(attr => {
        renderAttrGroup(container, attr, grouped[attr], {
          pool: poolAttrs.has(attr),
          mech: mechAttrs.has(attr)
        }, mechTag);
      });

      nonDirectableGroups.forEach(attr => {
        renderAttrGroup(container, attr, grouped[attr], null, mechTag);
      });
    }

    function renderAttrGroup(container, attr, group, direct, mechTag) {
      const section = document.createElement('div');
      section.className = 'recommend-group';

      const itemsHtml = group.map(item => {
        const stages = item.stages || [];
        const stagePill = stages.length > 0 ? `<span class="rc-stage">${toChinese(stages.length)}阶</span>` : '';
        return `
        <span class="recommend-card">
          <span class="rc-img-wrap"><img class="rc-img" src="${BASE_PATH}/images/high_value/${encodeURIComponent(item.name)}.png" alt="${item.name}" loading="lazy"></span>
          <span class="rc-name">${nameBlock(item.name)}</span>
          <span class="rc-attr">
            <span class="rc-attr-label">第一属性：</span>
            <img class="rc-attr-ico" src="${BASE_PATH}/images/attrs/${encodeURIComponent(item.attr)}.png" alt="${item.attr}">
            <span class="rc-attr-name">${item.attr}</span>
          </span>
          <span class="rc-foot">
            <span class="rc-star"><img src="${BASE_PATH}/images/star_value.png" alt="星光值">${item.value}</span>
            <span class="rc-coin"><img src="${BASE_PATH}/images/coin_value.png" alt="洛克贝">${item.coin}</span>
            ${stagePill}
          </span>
        </span>`;
      }).join('');

      // 分组头 tag：属性池定向 / 赛季机制定向（可内嵌金月/赤月）/ 不可定向
      let badges = '';
      if (direct) {
        if (direct.pool) badges += '<span class="dir-method pool">属性池定向</span>';
        if (direct.mech) {
          const sub = mechTag
            ? `<span class="m-sub" style="background:${mechTag.color}">${mechTag.text}</span>`
            : '';
          badges += `<span class="dir-method mech">赛季机制定向${sub}</span>`;
        }
      } else {
        badges = '<span class="dir-method none">不可定向</span>';
      }

      section.innerHTML = `
        <div class="recommend-group-header">
          <img class="dot" src="${BASE_PATH}/images/attrs/${encodeURIComponent(attr)}.png" alt="${attr}">
          <span class="attr-name">${attr}</span>
          <span class="count">(${group.length}只)</span>
          ${badges}
        </div>
        <div class="recommend-items">${itemsHtml}</div>
      `;

      section.querySelectorAll('.rc-img-wrap').forEach(w => bindPlaceholder(w, w.querySelector('img')));

      container.appendChild(section);
    }

    // ==================== 工具函数 ====================
    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 图片占位符：加载成功则隐藏"暂无图片"占位文字，失败则保留
    function bindPlaceholder(wrap, img) {
      if (!wrap || !img) return;
      img.addEventListener('load', () => wrap.classList.add('has-img'));
      img.addEventListener('error', () => wrap.classList.remove('has-img'));
    }

    // ==================== 常规/异色图交替（S1~S3，双图交叠平滑过渡） ====================
    // 异色图清单由 data/yise_images.json 驱动，仅在清单内的精灵启用交替，
    // 避免对不存在异色图的精灵产生 404 请求噪音；未来赛季更新只需补充清单。
    // 实现：容器内叠加两层 <img>（常规图/异色图各一层，均已预载），到点后仅切换两层
    // opacity，由 CSS transition 完成 2.4s 淡入淡出，两图交叠无硬切。
    const swapItems = [];
    let yiseImages = {};
    const SWAP_INTERVAL = 5000; // 每 5 秒切换一次
    function setupSwap(wrap, img, origSrc, name) {
      if (!wrap || !img || !origSrc || !name) return;
      const seasonId = currentSeasonData.season;
      const list = yiseImages[seasonId] || [];
      if (!list.includes(name)) return;
      const altSrc = origSrc.replace(/\.png$/, '_异色.png');

      const alt = document.createElement('img');
      alt.src = altSrc;
      alt.alt = img.alt || name;
      alt.style.opacity = '0';
      wrap.appendChild(alt);
      wrap.classList.add('sw-ready');
      img.style.opacity = '1';

      swapItems.push({ wrap, a: img, b: alt, showA: true });
    }
    setInterval(() => {
      // 清理已从 DOM 移除的旧容器（属性筛选/切换赛季会重建卡片），避免重复累积
      for (let i = swapItems.length - 1; i >= 0; i--) {
        if (!swapItems[i].wrap.isConnected) swapItems.splice(i, 1);
      }
      swapItems.forEach(item => {
        const cur = item.showA ? item.a : item.b;
        const nxt = item.showA ? item.b : item.a;
        item.showA = !item.showA;
        cur.style.opacity = '0';
        nxt.style.opacity = '1';
      });
    }, SWAP_INTERVAL);

    // 中文数字（阶段数）
    function toChinese(n) {
      const c = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      return n >= 1 && n <= 10 ? c[n - 1] : String(n);
    }

    // 卡片名称两行结构：主名一行，括号地区形态另起一行（小字灰色）；
    // 无括号的也输出空副行，保证所有卡片名称区高度一致
    function nameBlock(name) {
      const m = /^(.+?)（(.+)）$/.exec(name);
      if (m) {
        return `<span class="nm-main">${m[1]}</span><span class="nm-sub">（${m[2]}）</span>`;
      }
      return `<span class="nm-main">${name}</span><span class="nm-sub"></span>`;
    }

    // ==================== 启动 ====================
    init();
  }

  // ==================== 高星光值精灵页 ====================
  function initHighValue() {
    const app = document.getElementById('high-value-app');
    if (!app) return;
    const base = (location.pathname.indexOf('/pages/') >= 0) ? '..' : '.';
    const state = { sprites: [], seasonMap: {}, view: 'attr', f: { attr: '', value: '' } };
    const ORDER = ['普通','草','火','水','光','地','冰','龙','电','毒','虫','武','翼','萌','幽','恶','机械','幻'];
    const attrColors = {
      "普通": "#3080B0", "草": "#40B070", "火": "#D05020", "水": "#60A0F0",
      "光": "#40C0F0", "地": "#907030", "冰": "#50A0D0", "龙": "#E04060",
      "电": "#E0C000", "毒": "#B060E0", "虫": "#90C020", "武": "#F09030",
      "翼": "#30C0C0", "萌": "#F070A0", "幽": "#9040E0", "恶": "#C04070",
      "机械": "#40C0A0", "幻": "#90A0F0"
    };
    const content = document.getElementById('hv-content');
    const attrBtnWrap = document.getElementById('hv-attr-buttons');
    const valueBtnWrap = document.getElementById('hv-value-buttons');
    const cn = ['一','二','三','四','五','六','七','八','九','十'];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const attrIcon = a => `${base}/images/attrs/${encodeURIComponent(a)}.png`;
    const imgOf = n => `${base}/images/high_value/${encodeURIComponent(n)}.png`;
    const avatarOf = n => `${base}/images/high_value/avatars/${encodeURIComponent(n)}.png`;
    const starOf = () => `${base}/images/star_value.png`;
    const coinOf = () => `${base}/images/coin_value.png`;
    const normAttr = t => String(t || '').replace(/[／/]\s*/g, '/').replace(/\s+/g, '');
    const splitAttrs = t => String(t || '').split('/').map(x => x.trim()).filter(Boolean);
    const sortAttrs = arr => Array.from(new Set(arr)).sort((a,b) => { const i=ORDER.indexOf(a), j=ORDER.indexOf(b); return (i<0?99:i)-(j<0?99:j); });

    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${alpha})`;
    };
    function attrTag(a) {
      const color = attrColors[a] || '#666';
      return `<span class="hv-tag" style="--ac:${color};background:${hexToRgba(color,0.1)};border-color:${color};color:${color}"><img src="${attrIcon(a)}" alt="" loading="lazy">${esc(a)}</span>`;
    }
    const attrCell = s => `<span class="hv-tags">${splitAttrs(normAttr(s.attrFull) || s.attr).map(attrTag).join('')}</span>`;
    const firstAttrCell = s => `<span class="hv-tags">${splitAttrs(s.attr).map(attrTag).join('')}</span>`;

    function bgLuminance(hex) {
      const n = parseInt(hex.replace('#',''), 16);
      const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
      return (0.299*r + 0.587*g + 0.114*b) / 255;
    }
    function seasonColor(text) {
      const m = /^(S\d+)/.exec(text || '');
      return (m && state.seasonMap[m[1]]) || '#6b7280';
    }
    function seasonTag(text) {
      if (!text) return '';
      const bg = seasonColor(text);
      const fg = bgLuminance(bg) > 0.6 ? '#1d2a3c' : '#fff';
      return `<span class="hv-season" style="background:${bg};color:${fg}">${esc(text)}</span>`;
    }
    function seasonsOf(s, primary) {
      const out = [];
      const add = t => { t = String(t || '').trim(); if (t && !out.includes(t)) out.push(t); };
      add(primary || s.season);
      (s.extraSeasons || []).forEach(add);
      return out;
    }
    const seasonTagsHtml = (s, primary) => {
      const list = seasonsOf(s, primary);
      return list.length ? `<span class="hv-seasons">${list.map(seasonTag).join('')}</span>` : '';
    };
    const stageCell = s => {
      const n = (s.stages || []).length;
      return n ? `<span class="hv-stage">${cn[n-1]}阶</span>` : '<span class="hv-dim">—</span>';
    };
    const numCell = (icon, val) => `<span class="hv-num"><img src="${icon()}" alt="">${esc(val)}</span>`;

    // ==================== 属性按钮筛选（仅第一属性，风格同属性池匹配页） ====================
    function renderAttrFilter() {
      attrBtnWrap.innerHTML = '';
      const makeBtn = (attr, label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'attr-btn' + (attr === state.f.attr ? ' active' : '') + (attr ? '' : ' all');
        btn.dataset.attr = attr || 'all';
        if (attr) {
          const color = attrColors[attr] || '#666';
          btn.style.setProperty('--ac', color);
          btn.style.setProperty('--abg', hexToRgba(color, 0.12));
          btn.innerHTML = `<img src="${attrIcon(attr)}" alt="${attr}">${attr}`;
        } else {
          btn.textContent = '全部';
        }
        btn.addEventListener('click', () => {
          if (state.f.attr === attr) return;
          state.f.attr = attr;
          attrBtnWrap.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.attr === (attr || 'all')));
          render();
        });
        attrBtnWrap.appendChild(btn);
      };
      makeBtn('', '全部');
      const attrs = sortAttrs(state.sprites.map(s => s.attr));
      attrs.forEach(a => makeBtn(a, a));
    }

    function renderValueFilter() {
      if (!valueBtnWrap) return;
      valueBtnWrap.innerHTML = '';
      const valColor = '#e0a93a';
      const makeBtn = (val, label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'attr-btn' + (String(val) === String(state.f.value) ? ' active' : '') + (val === '' ? ' all' : '');
        btn.dataset.val = val === '' ? 'all' : String(val);
        if (val === '') {
          btn.textContent = '全部';
        } else {
          btn.style.setProperty('--ac', valColor);
          btn.style.setProperty('--abg', hexToRgba(valColor, 0.12));
          btn.innerHTML = `<img src="${starOf()}" alt="星光值">${label}`;
        }
        btn.addEventListener('click', () => {
          if (String(state.f.value) === String(val)) return;
          state.f.value = val;
          valueBtnWrap.querySelectorAll('.attr-btn').forEach(b => b.classList.toggle('active', b.dataset.val === (val === '' ? 'all' : String(val))));
          render();
        });
        valueBtnWrap.appendChild(btn);
      };
      makeBtn('', '全部');
      const values = Array.from(new Set(state.sprites.map(s => s.value))).sort((a, b) => a - b);
      values.forEach(v => makeBtn(v, String(v)));
    }

    async function load() {
      const [hv, ss] = await Promise.all([
        fetch(`${base}/data/high_value_sprites.json`).then(r => r.json()),
        fetch(`${base}/data/seasons.json`).then(r => r.json())
      ]);
      state.sprites = hv.sprites || [];
      (ss.seasons || []).forEach(x => { state.seasonMap[x.id] = x.themeColor || '#666'; });
      renderAttrFilter();
      renderValueFilter();
      render();
    }

    function visible() {
      let arr = state.sprites;
      if (state.f.attr) arr = arr.filter(s => s.attr === state.f.attr);
      if (state.f.value !== '') arr = arr.filter(s => Number(s.value) === Number(state.f.value));
      return arr;
    }

    function card(s) {
      const stage = (s.stages && s.stages.length) ? `<span class="rc-stage">${cn[s.stages.length-1]}阶</span>` : '';
      const forms = s.forms || [];
      const inline = forms.length ? `<details class="hv-inline"><summary>＋ 地区形态（${forms.length}）</summary><div class="hv-inline-list">${forms.map(f => esc(f.name)).join('、')}</div></details>` : '';
      const seasons = seasonTagsHtml(s, s.season);
      return `
        <span class="recommend-card hv-card">
          <span class="rc-img-wrap"><img class="rc-img" src="${imgOf(s.name)}" alt="${esc(s.name)}" loading="lazy"></span>
          <span class="rc-name">${esc(s.name)}</span>
          <span class="rc-attr"><span class="rc-attr-label">第一属性：</span><img class="rc-attr-ico" src="${attrIcon(s.attr)}" alt=""><span class="rc-attr-name">${esc(s.attr)}</span></span>
          <span class="rc-foot">
            <span class="rc-star">${numCell(starOf, s.value)}</span>
            <span class="rc-coin">${numCell(coinOf, s.coin)}</span>
            ${stage}
          </span>
          ${seasons ? `<span class="rc-season-line">${seasons}</span>` : ''}
          ${inline}
        </span>`;
    }

    function renderAttr(list) {
      const groups = {};
      list.forEach(s => { (groups[s.attr] = groups[s.attr] || []).push(s); });
      const keys = sortAttrs(Object.keys(groups));
      const html = keys.map((attr, i) => `
        <section class="recommend-group hv-group" id="hv-g-${i}">
          <div class="recommend-group-header">
            <img class="dot" src="${attrIcon(attr)}" alt="">
            <span class="attr-name">${esc(attr)}</span>
            <span class="count">(${groups[attr].length}只)</span>
          </div>
          <div class="recommend-items">${groups[attr].map(card).join('')}</div>
        </section>`).join('');
      content.innerHTML = `<div class="hv-groups">${html}</div>`;
    }

    const PH_IMG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" rx="18" fill="#eef1f5"/><g fill="#c3ccd8"><circle cx="44" cy="33" r="15"/><path d="M17 76c3-24 15-35 27-35s24 11 27 35z"/></g></svg>');

    const dataCells = (s, seasonText, f) => {
      const eff = f ? Object.assign({}, s, {
        attr: f.attr || s.attr,
        attrFull: f.attrFull || s.attrFull || s.attr
      }) : s;
      return `
        <td>${stageCell(s)}</td>
        <td>${firstAttrCell(eff)}</td>
        <td>${attrCell(eff)}</td>
        <td>${numCell(starOf, s.value)}</td>
        <td>${numCell(coinOf, s.coin)}</td>
        <td>${seasonTagsHtml(s, seasonText)}</td>
        <td>${esc(s.obtain || '—')}</td>`;
    };

    function formRow(s, f) {
      return `
        <tr class="hv-form-row" hidden>
          <td class="hv-name"><span class="hv-name-in"><span class="hv-slot" aria-hidden="true"></span><img class="hv-ava hv-form-ava" src="${avatarOf(f.name)}" alt="" loading="lazy"><span class="hv-name-text">${esc(f.name)}</span></span></td>${dataCells(s, f.season || s.season, f)}
        </tr>`;
    }

    function formsRows(s) {
      return (s.forms || []).map(f => formRow(s, f)).join('');
    }

    function tableRow(s) {
      const hasF = (s.forms || []).length > 0;
      const slot = hasF
        ? `<button type="button" class="hv-plus" aria-label="地区形态">＋</button>`
        : `<span class="hv-slot" aria-hidden="true"></span>`;
      return `
        <tr>
          <td class="hv-name"><span class="hv-name-in">${slot}<img class="hv-ava" src="${avatarOf(s.name)}" alt="" loading="lazy"><span class="hv-name-text">${esc(s.name)}</span></span></td>${dataCells(s, s.season)}
        </tr>${formsRows(s)}`;
    }

    const HV_COL_W = ['26%', '8%', '9%', '12%', '9%', '9%', '13%', '14%'];

    function renderTable(list) {
      const rows = list.map(tableRow).join('');
      content.innerHTML = `<div class="hv-table-card">
        <table class="hv-table">
          <colgroup>${HV_COL_W.map(w => `<col style="width:${w}">`).join('')}</colgroup>
          <thead><tr><th class="hv-th-name">精灵名称</th><th>阶段</th><th>第一属性</th><th>属性</th><th>星光值</th><th>洛克贝</th><th>所属赛季</th><th>获取方式</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    }

    function bindImages(root) {
      root.querySelectorAll('img').forEach(img => {
        if (img.dataset.hvBound) return;
        img.dataset.hvBound = '1';
        const markLoaded = () => {
          const wrap = img.closest('.rc-img-wrap');
          if (wrap) wrap.classList.add('has-img');
        };
        img.addEventListener('load', markLoaded);
        if (img.complete && img.naturalWidth > 0) markLoaded();
        img.addEventListener('error', () => {
          if (img.classList.contains('hv-form-ava')) {
            img.src = PH_IMG;
            img.style.visibility = 'visible';
          } else {
            img.style.visibility = 'hidden';
          }
        });
      });
    }

    function render() {
      const list = visible();
      content.innerHTML = '';
      if (state.view === 'table') { renderTable(list); }
      else { renderAttr(list); }
      bindImages(content);
      content.querySelectorAll('.hv-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const tr = btn.closest('tr');
          const rows = [];
          let el = tr && tr.nextElementSibling;
          while (el && el.classList.contains('hv-form-row')) {
            rows.push(el);
            el = el.nextElementSibling;
          }
          if (!rows.length) return;
          const show = rows[0].hidden;
          rows.forEach(r => { r.hidden = !show; });
          btn.classList.toggle('open', show);
        });
      });
    }

    app.querySelectorAll('.hv-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.view;
        app.querySelectorAll('.hv-btn').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
    });
    load();
  }

  initMatcher();
  if (document.getElementById('high-value-app')) initHighValue();
})();

