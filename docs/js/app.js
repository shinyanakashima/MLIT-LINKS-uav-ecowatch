'use strict';

/* EcoWatch — ドローン環境モニタリング共創エリア探索
 * 出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成
 * 背景地図：地理院タイル（国土地理院）
 *
 * 出発地は行政区域の代表地点に秘匿化されているため、約29万件の環境用途レコードは
 * 約1,800の市区町村地点に集計される。本アプリは municipalities.json を読み込み、
 * 選択中のフィルタに応じて件数を集計し、市区町村集計（円）／ヒートマップとして描画する。
 */

const GSI_ATTRIB =
  '地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> / ' +
  '出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工';

const BASEMAPS = {
  std:   { url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',           max: 18 },
  pale:  { url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',          max: 18 },
  photo: { url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', max: 18 },
};
const SHINRIN_URL = 'https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png';

const state = {
  months: [],
  monthStart: null,
  monthEnd: null,
  env: true,
  nat: true,
  exclComp: true,
  view: 'muni',     // muni | heat
  basemap: 'std',
  muni: null,
  shizen: null,     // 自然公園地域 GeoJSON
};

let map;

const fmt = (n) => Number(n).toLocaleString(i18nLang() === 'en' ? 'en-US' : 'ja-JP');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- base style ----
function buildStyle() {
  const bm = BASEMAPS[state.basemap];
  return {
    version: 8,
    glyphs: './vendor/glyphs/{fontstack}/{range}.pbf',
    sources: {
      base: { type: 'raster', tiles: [bm.url], tileSize: 256, maxzoom: bm.max, attribution: GSI_ATTRIB },
      shinrin: { type: 'raster', tiles: [SHINRIN_URL], tileSize: 256, maxzoom: 16 },
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base' },
      { id: 'shinrin', type: 'raster', source: 'shinrin', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.5 } },
    ],
  };
}

// ---- filtering / aggregation ----
function activeMonthSet() {
  const s = state.months.indexOf(state.monthStart);
  const e = state.months.indexOf(state.monthEnd);
  const [a, b] = s <= e ? [s, e] : [e, s];
  return new Set(state.months.slice(a, b + 1));
}

// per month buckets: e/n/b = 環境のみ/自然のみ/両方（通常）、ce/cn/cb = 包括申請
function muniCount(item, monthsSet) {
  let total = 0;
  for (const mo in item.m) {
    if (!monthsSet.has(mo)) continue;
    const d = item.m[mo];
    if (state.env && state.nat) total += (d.e || 0) + (d.n || 0) + (d.b || 0);
    else if (state.env) total += (d.e || 0) + (d.b || 0);
    else if (state.nat) total += (d.n || 0) + (d.b || 0);
    if (!state.exclComp) {
      if (state.env && state.nat) total += (d.ce || 0) + (d.cn || 0) + (d.cb || 0);
      else if (state.env) total += (d.ce || 0) + (d.cb || 0);
      else if (state.nat) total += (d.cn || 0) + (d.cb || 0);
    }
  }
  return total;
}

function buildMuniGeojson() {
  const monthsSet = activeMonthSet();
  const features = [];
  let shown = 0;
  let placesShown = 0;
  for (const it of state.muni.items) {
    const c = muniCount(it, monthsSet);
    if (c <= 0) continue;
    shown += c;
    placesShown += 1;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [it.lng, it.lat] },
      properties: { dep: it.dep, count: c },
    });
  }
  document.getElementById('m-shown').textContent = fmt(shown);
  document.getElementById('m-muni').textContent = fmt(placesShown);
  return { type: 'FeatureCollection', features };
}

// ---- natural environment layer (自然公園地域 / 国土数値情報 A10) ----
function addNatureLayer() {
  map.addSource('shizen', { type: 'geojson', data: state.shizen });
  map.addLayer({
    id: 'shizen-fill', type: 'fill', source: 'shizen',
    paint: { 'fill-color': '#2ea05a', 'fill-opacity': 0.22 },
  });
  map.addLayer({
    id: 'shizen-line', type: 'line', source: 'shizen',
    paint: { 'line-color': '#1f7d44', 'line-width': 0.8, 'line-opacity': 0.55 },
  });
}

// ---- layers ----
function addDataLayers() {
  map.addSource('muni', { type: 'geojson', data: buildMuniGeojson() });

  map.addLayer({
    id: 'muni-heat', type: 'heatmap', source: 'muni',
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, 3, 0.25, 20, 0.6, 100, 1.1, 500, 1.8],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 12, 2.4],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 12, 9, 26, 14, 42],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.85, 16, 0.5],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)', 0.2, '#2c7fb8', 0.4, '#7fcdbb', 0.6, '#c7e9b4', 0.8, '#fee08b', 1, '#d73027'],
    },
  });

  map.addLayer({
    id: 'muni-circle', type: 'circle', source: 'muni',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'count']], 0, 4, 5, 10, 20, 22, 60, 36, 200, 50],
      'circle-color': ['interpolate', ['linear'], ['get', 'count'],
        1, '#2c7fb8', 10, '#41b6c4', 50, '#a1dab4', 150, '#fee08b', 500, '#fc8d59', 1500, '#d73027'],
      'circle-opacity': 0.62,
      'circle-stroke-color': '#06212f',
      'circle-stroke-width': 1,
    },
  });

  map.addLayer({
    id: 'muni-label', type: 'symbol', source: 'muni',
    minzoom: 6,
    layout: {
      'text-field': ['to-string', ['get', 'count']],
      'text-size': 11, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false,
    },
    paint: { 'text-color': '#f4fbff', 'text-halo-color': '#06212f', 'text-halo-width': 1.3 },
  });
}

function setVis(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }

function applyView() {
  const heat = state.view === 'heat';
  setVis('muni-heat', heat);
  setVis('muni-label', !heat);
  setVis('muni-circle', true); // 円は常に表示（ヒートマップ時は薄く、クリック可能）
  map.setPaintProperty('muni-circle', 'circle-opacity', heat ? 0.0 : 0.62);
  map.setPaintProperty('muni-circle', 'circle-stroke-width', heat ? 0 : 1);
  updateLegend();
}

function refilter() {
  if (map.getSource('muni')) map.getSource('muni').setData(buildMuniGeojson());
}

function updateLegend() {
  const el = document.getElementById('legend-body');
  if (state.view === 'heat') {
    el.innerHTML = `<div class="row"><span class="grad"></span></div>
      <div class="row" style="justify-content:space-between"><span>${t('legend_low')}</span><span>${t('legend_density')}</span><span>${t('legend_high')}</span></div>`;
  } else {
    el.innerHTML = `
      <div class="row"><span class="bubble" style="width:10px;height:10px;background:#2c7fb8;border-color:#2c7fb8"></span>${t('legend_few')}</div>
      <div class="row"><span class="bubble" style="width:18px;height:18px;background:#a1dab4;border-color:#a1dab4"></span>${t('legend_mid')}</div>
      <div class="row"><span class="bubble" style="width:28px;height:28px;background:#fc8d59;border-color:#fc8d59"></span>${t('legend_many')}</div>
      <div class="row" style="color:#9fb1c1">${t('legend_note')}</div>`;
  }
}

// ---- basemap switching ----
function switchBasemap() {
  const bm = BASEMAPS[state.basemap];
  const firstId = 'shinrin';
  if (map.getLayer('base')) map.removeLayer('base');
  if (map.getSource('base')) map.removeSource('base');
  map.addSource('base', { type: 'raster', tiles: [bm.url], tileSize: 256, maxzoom: bm.max, attribution: GSI_ATTRIB });
  map.addLayer({ id: 'base', type: 'raster', source: 'base' }, firstId);
}

// ---- interactions ----
function setupInteractions() {
  map.on('click', 'muni-circle', (e) => {
    const p = e.features[0].properties;
    const sep = i18nLang() === 'en' ? ' – ' : '〜';
    const period = `${monthLabel(state.monthStart)}${sep}${monthLabel(state.monthEnd)}`;
    const tags = [];
    if (state.env) tags.push(`<span class="tag env">${t('env')}</span>`);
    if (state.nat) tags.push(`<span class="tag nat">${t('nat')}</span>`);
    if (!state.exclComp) tags.push(`<span class="tag">${t('pop_comp')}</span>`);
    const count = t('pop_unit') ? `${fmt(+p.count)} ${t('pop_unit')}` : fmt(+p.count);
    new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="pop"><h3>${esc(p.dep)}</h3>
        <div class="tags">${tags.join('')}</div>
        <dl><dt>${t('pop_count')}</dt><dd>${count}</dd><dt>${t('pop_period')}</dt><dd>${esc(period)}</dd></dl>
        <div class="disc">${t('pop_disc')}</div></div>`)
      .addTo(map);
  });
  map.on('mouseenter', 'muni-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'muni-circle', () => { map.getCanvas().style.cursor = ''; });
}

// ---- UI wiring ----
function fillMonthSelects() {
  const ss = document.getElementById('f-month-start');
  const es = document.getElementById('f-month-end');
  for (const m of state.months) {
    ss.add(new Option(monthLabel(m), m));
    es.add(new Option(monthLabel(m), m));
  }
  state.monthStart = state.months[0];
  state.monthEnd = state.months[state.months.length - 1];
  ss.value = state.monthStart;
  es.value = state.monthEnd;
  ss.onchange = () => { state.monthStart = ss.value; refilter(); };
  es.onchange = () => { state.monthEnd = es.value; refilter(); };
}

// 言語切替時に月セレクトのラベルを振り直す（選択値は維持）
function relabelMonths() {
  for (const id of ['f-month-start', 'f-month-end']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    for (const opt of sel.options) opt.textContent = monthLabel(opt.value);
  }
}

function renderGenInfo(s) {
  const el = document.getElementById('gen-info');
  if (!el || !s) return;
  const first = monthLabel(s.months[0]);
  const last = monthLabel(s.months[s.months.length - 1]);
  if (i18nLang() === 'en') {
    el.textContent =
      `Generated: ${s.generated} / Coverage: ${first} – ${last} (monthly) / ` +
      `Of ${fmt(s.scanned_total)} scanned records, ${fmt(s.total)} environmental-purpose ` +
      `(environmental survey / nature observation) records were extracted ` +
      `(${fmt(s.genuine_total)} regular / ${fmt(s.comprehensive_total)} blanket applications).`;
  } else {
    el.textContent =
      `生成日時：${s.generated}／対象：${first}〜${last}（月次）／走査 ${fmt(s.scanned_total)} 件中、` +
      `環境用途（環境調査・自然観測）${fmt(s.total)} 件を抽出` +
      `（通常 ${fmt(s.genuine_total)} 件／包括申請 ${fmt(s.comprehensive_total)} 件）。`;
  }
}

// 言語切替: 静的UI＋動的テキストをまとめて再描画
function applyAllI18n() {
  applyStaticI18n();
  relabelMonths();
  renderGenInfo(state.summary);
  updateLegend();
  refilter(); // m-total/m-shown 等の数値ロケールを更新
  document.getElementById('m-total').textContent = fmt(state.summary.genuine_total ?? state.summary.total);
  document.getElementById('m-months').textContent = fmt(state.summary.months.length);
  const lt = document.getElementById('lang-toggle');
  if (lt) lt.textContent = t('lang_other');
}

function wireControls() {
  document.querySelectorAll('input[name=viewmode]').forEach((r) => {
    r.onchange = () => { if (r.checked) { state.view = r.value; applyView(); } };
  });
  document.querySelectorAll('input[name=basemap]').forEach((r) => {
    r.onchange = () => { if (r.checked) { state.basemap = r.value; switchBasemap(); } };
  });
  document.getElementById('f-env').onchange = (e) => { state.env = e.target.checked; refilter(); };
  document.getElementById('f-nat').onchange = (e) => { state.nat = e.target.checked; refilter(); };
  document.getElementById('f-excl-comp').onchange = (e) => { state.exclComp = e.target.checked; refilter(); };
  document.getElementById('l-shinrin').onchange = (e) => setVis('shinrin', e.target.checked);
  const shz = document.getElementById('l-shizen');
  if (shz) shz.onchange = (e) => { setVis('shizen-fill', e.target.checked); setVis('shizen-line', e.target.checked); };
  document.getElementById('panel-toggle').onclick = () => document.getElementById('panel').classList.toggle('open');
  const lt = document.getElementById('lang-toggle');
  if (lt) lt.onclick = () => { i18nSetLang(i18nLang() === 'en' ? 'ja' : 'en'); applyAllI18n(); };
}

async function init() {
  const summary = await fetch('./data/summary.json').then((r) => r.json());
  state.muni = await fetch('./data/municipalities.json').then((r) => r.json());
  try {
    state.shizen = await fetch('./data/shizen_koen.geojson').then((r) => { if (!r.ok) throw 0; return r.json(); });
  } catch (e) { state.shizen = null; }
  state.months = summary.months;
  state.summary = summary;

  applyStaticI18n();
  const lt = document.getElementById('lang-toggle');
  if (lt) lt.textContent = t('lang_other');

  const shizenChk = document.getElementById('l-shizen');
  if (!state.shizen && shizenChk) { shizenChk.checked = false; shizenChk.disabled = true; const l = shizenChk.closest('label'); if (l) l.style.opacity = 0.45; }

  // 飛行範囲ポリゴン（個票）はベクトルタイル化を要するため当面無効
  if (!summary.has_areas) {
    const areaRadio = document.querySelector('input[name=viewmode][value=area]');
    if (areaRadio) { areaRadio.disabled = true; const l = areaRadio.closest('label'); if (l) l.style.opacity = 0.45; }
  }

  document.getElementById('m-total').textContent = fmt(summary.genuine_total ?? summary.total);
  document.getElementById('m-months').textContent = fmt(summary.months.length);
  renderGenInfo(summary);

  fillMonthSelects();
  wireControls();

  map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: [138.2, 37.6],
    zoom: 4.3,
    minZoom: 3,
    maxZoom: 17,
    hash: 'loc',
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    if (state.shizen) addNatureLayer();
    addDataLayers();
    setupInteractions();
    applyView();
    document.getElementById('loading')?.remove();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const ld = document.createElement('div');
  ld.id = 'loading';
  ld.innerHTML = `<span class="spinner"></span>${t('loading')}`;
  document.getElementById('map').appendChild(ld);
  init().catch((err) => {
    ld.innerHTML = t('load_error') + esc(err.message || err);
    console.error(err);
  });
});
