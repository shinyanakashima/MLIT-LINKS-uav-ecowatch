'use strict';

/* EcoWatch 多言語化（日本語／English）
 * 静的UIは data-i18n / data-i18n-html / data-i18n-aria 属性で差し替え、
 * 動的テキスト（凡例・ポップアップ・サマリ等）は t(key) で取得する。
 */

const I18N = {
  ja: {
    title: 'EcoWatch — ドローン環境モニタリング共創エリア探索',
    subtitle: 'ドローン環境モニタリング共創エリア探索',
    topbar_note: '環境調査・自然観測を目的とするドローン<strong>飛行計画（申請ベース）</strong>の分布',
    panel_toggle: 'パネル開閉',
    lang_other: 'EN',

    notice: '本マップは<strong>飛行計画（申請・報告）ベース</strong>であり、実際の飛行・実態を示すものではありません。元データは紙資料のスキャンから抽出されており、完全性・正確性は保証されません。',

    h_summary: 'データ概要',
    m_total: '環境用途の飛行計画',
    m_muni: '出発地 市区町村',
    m_months: '対象月',
    m_shown: '表示中',

    h_viewmode: '表示モード',
    vm_muni: '市区町村集計（出発地）',
    vm_heat: 'ヒートマップ',
    vm_area: '飛行範囲ポリゴン（今後追加）',
    viewmode_hint: '飛行範囲ポリゴン（個票 約29万件）はベクトルタイル化を前提とし、今後追加予定です。出発地は行政区域の代表地点に秘匿化されているため、分布は市区町村粒度で表示します。',

    h_purpose: '飛行目的でしぼり込み',
    env: '環境調査',
    nat: '自然観測',
    excl_comp: '包括申請（目的を多数選択）を除外',
    purpose_hint: '飛行目的フラグが極端に多い行は、用途を絞らない包括的な申請とみなして既定で除外します。',

    h_period: '対象期間',
    period_start: '開始',
    period_end: '終了',

    h_layers: '背景地図・レイヤ',
    bm_std: '地理院 標準',
    bm_pale: '淡色',
    bm_photo: '衛星写真',
    l_shizen: '自然公園地域（国立・国定・都道府県立）',
    l_shinrin: '地形陰影（地理院 陰影起伏図）',
    layers_hint: '自然公園地域：国土数値情報「自然公園地域データ(A10)」。河川・森林域レイヤは今後追加予定です。',

    h_legend: '凡例',
    legend_density: '飛行計画 密度',
    legend_low: '低',
    legend_high: '高',
    legend_few: '少（〜数件）',
    legend_mid: '中',
    legend_many: '多',
    legend_note: '円の大きさ・色＝出発地の飛行計画件数',

    h_source: '出典・ライセンス',
    source1: '出典：国土交通省 Project LINKS『無人航空機飛行計画データ（2025年度）』を加工して作成。',
    source2: '公共データ利用規約（第1.0版）／CC BY 4.0 互換。背景地図：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル（国土地理院）</a>。',
    source3: '自然公園地域：<a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A10-v3_1.html" target="_blank" rel="noopener">国土数値情報「自然公園地域データ(A10)」（国土交通省）</a>を加工して作成。',
    source_fine: '元データは秘匿化済み（出発地は行政区域の代表地点）。本サイトは個人特定につながる二次加工を行いません。',

    loading: 'データを読み込み中…',
    load_error: 'データの読み込みに失敗しました：',

    // popup
    pop_count: '飛行計画',
    pop_unit: '件',
    pop_period: '対象期間',
    pop_comp: '包括含む',
    pop_disc: '出発地の行政区域代表地点に集計（秘匿化済み）。申請・報告ベースであり実飛行・実態ではありません。データ品質は非保証。',
  },

  en: {
    title: 'EcoWatch — Exploring co-creation areas for drone environmental monitoring',
    subtitle: 'Drone environmental monitoring co-creation explorer',
    topbar_note: 'Distribution of drone <strong>flight plans (as filed)</strong> for environmental survey / nature observation',
    panel_toggle: 'Toggle panel',
    lang_other: '日本語',

    notice: 'This map is based on <strong>filed flight plans (applications/reports)</strong>, not actual flights or outcomes. The source data was extracted from scanned paper documents, so completeness and accuracy are not guaranteed.',

    h_summary: 'Overview',
    m_total: 'Environmental flight plans',
    m_muni: 'Departure municipalities',
    m_months: 'Months covered',
    m_shown: 'Currently shown',

    h_viewmode: 'View mode',
    vm_muni: 'By municipality (departure)',
    vm_heat: 'Heatmap',
    vm_area: 'Flight-area polygons (coming soon)',
    viewmode_hint: 'Flight-area polygons (~290k records) require vector tiling and are planned for a future release. Departure points are anonymized to municipal representative points, so the distribution is shown at municipality resolution.',

    h_purpose: 'Filter by flight purpose',
    env: 'Environmental survey',
    nat: 'Nature observation',
    excl_comp: 'Exclude blanket applications (many purposes selected)',
    purpose_hint: 'Records with an unusually large number of purpose flags are treated as broad “blanket” applications and excluded by default.',

    h_period: 'Period',
    period_start: 'From',
    period_end: 'To',

    h_layers: 'Basemap & layers',
    bm_std: 'GSI Standard',
    bm_pale: 'Pale',
    bm_photo: 'Satellite',
    l_shizen: 'Natural parks (national / quasi-national / prefectural)',
    l_shinrin: 'Hillshade (GSI shaded relief)',
    layers_hint: 'Natural parks: MLIT National Land Numerical Information “Natural Park Areas (A10)”. River and forest layers are planned.',

    h_legend: 'Legend',
    legend_density: 'Flight-plan density',
    legend_low: 'Low',
    legend_high: 'High',
    legend_few: 'Few (~several)',
    legend_mid: 'Medium',
    legend_many: 'Many',
    legend_note: 'Circle size / color = flight plans by departure municipality',

    h_source: 'Source & license',
    source1: 'Source: created by processing MLIT Project LINKS “Unmanned Aircraft Flight Plan Data (FY2025)”.',
    source2: 'Public Data License (v1.0) / CC BY 4.0 compatible. Basemap: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">GSI Tiles (Geospatial Information Authority of Japan)</a>.',
    source3: 'Natural parks: created by processing <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A10-v3_1.html" target="_blank" rel="noopener">MLIT National Land Numerical Information “Natural Park Areas (A10)”</a>.',
    source_fine: 'The source data is anonymized (departure points are municipal representative points). This site performs no secondary processing that could identify individuals.',

    loading: 'Loading data…',
    load_error: 'Failed to load data: ',

    pop_count: 'Flight plans',
    pop_unit: '',
    pop_period: 'Period',
    pop_comp: 'incl. blanket',
    pop_disc: 'Aggregated to the municipal representative point of the departure location (anonymized). Based on filed plans/reports, not actual flights; data quality is not guaranteed.',
  },
};

const MONTHS_EN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let _lang = (() => {
  try { return localStorage.getItem('ecowatch_lang') || 'ja'; } catch (e) { return 'ja'; }
})();

function i18nLang() { return _lang; }

function i18nSetLang(l) {
  _lang = (l === 'en') ? 'en' : 'ja';
  try { localStorage.setItem('ecowatch_lang', _lang); } catch (e) { /* ignore */ }
}

function t(key) {
  const d = I18N[_lang] || I18N.ja;
  return (key in d) ? d[key] : (I18N.ja[key] ?? key);
}

// 'YYYY-MM' を言語に応じたラベルに整形
function monthLabel(m) {
  const [y, mm] = m.split('-');
  if (_lang === 'en') return `${MONTHS_EN[+mm]} ${y}`;
  return `${y}年${+mm}月`;
}

function applyStaticI18n() {
  document.documentElement.lang = _lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
