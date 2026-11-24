/* ===== QRX：QR 碼外觀引擎＋編輯器（需要 qrcode-generator） ===== */
(function(){
if (window.qrcode && qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const DEFAULT = {
  pattern:'square', eyeOuter:'square', eyeInner:'square',
  fill:'solid', fg:'#000000', fg2:'#3d6b5a', angle:45,
  customEye:false, eyeOuterColor:'#000000', eyeInnerColor:'#000000',
  bg:'#ffffff', transparent:false,
  logo:'', logoSize:0.22, logoPlate:true, ec:'M', margin:4,
  frame:'none', frameColor:'#000000', frameText:'SCAN ME'
};

const PATTERNS = [
  ['square','方塊'], ['small','小方塊'], ['rounded','圓角'], ['connected','流線'], ['dot','圓點'],
  ['classy','葉片'], ['diamond','菱形'], ['plus','十字'], ['vbar','直條'], ['hbar','橫條']
];
const EYE_OUTER = [['square','方形'], ['rounded','圓角'], ['extra','大圓角'], ['circle','圓形'], ['leaf','葉片']];
const EYE_INNER = [['square','方形'], ['rounded','圓角'], ['circle','圓形'], ['leaf','葉片'], ['diamond','菱形']];
const FRAMES = [['none','無'], ['bottom','底部文字'], ['top','頂部文字'], ['bubble','對話框'], ['circle','圓形徽章'], ['outline','細線框']];

const TEMPLATES = [
  ['經典', {}],
  ['森林', {pattern:'rounded', eyeOuter:'rounded', eyeInner:'rounded', fill:'linear', fg:'#2a4a3e', fg2:'#4b8068', frame:'bottom', frameColor:'#2a4a3e'}],
  ['海洋', {pattern:'dot', eyeOuter:'extra', eyeInner:'circle', fill:'linear', fg:'#1e3a8a', fg2:'#0369a1', customEye:true, eyeOuterColor:'#1e3a8a', eyeInnerColor:'#0284c7', frame:'bubble', frameColor:'#1e3a8a'}],
  ['莓果', {pattern:'classy', eyeOuter:'leaf', eyeInner:'leaf', fill:'linear', fg:'#7e22ce', fg2:'#db2777', frame:'bottom', frameColor:'#7e22ce'}],
  ['夕陽', {pattern:'connected', eyeOuter:'rounded', eyeInner:'square', fill:'radial', fg:'#c2410c', fg2:'#7c2d12', bg:'#fff7ed', frame:'top', frameColor:'#c2410c'}],
  ['墨水徽章', {pattern:'dot', eyeOuter:'circle', eyeInner:'circle', fg:'#111827', frame:'circle', frameColor:'#111827'}],
  ['書店', {pattern:'vbar', eyeOuter:'rounded', eyeInner:'rounded', fg:'#5b3a29', bg:'#fdf6ec', customEye:true, eyeOuterColor:'#5b3a29', eyeInnerColor:'#b45309', frame:'outline', frameColor:'#5b3a29'}],
  ['極簡', {pattern:'small', eyeOuter:'extra', eyeInner:'circle', fg:'#334155', frame:'none'}]
];

/* ---------- 色彩 ---------- */
function lum(hex){
  const v = (hex || '#000').replace('#',''), rgb = [0,2,4].map(i => parseInt(v.substr(i,2),16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
}
function contrast(a, b){ const x = lum(a), y = lum(b); return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05); }
function ink(bg){ return lum(bg) > 0.4 ? '#111111' : '#ffffff'; }
function escX(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- 形狀 ---------- */
const f = v => +v.toFixed(3);
function rr4(x, y, w, h, r){ // r = [tl,tr,br,bl]
  var a = Math.min(r[0], w/2, h/2), b = Math.min(r[1], w/2, h/2), c = Math.min(r[2], w/2, h/2), d = Math.min(r[3], w/2, h/2);
  var arc = function(rad, ex, ey){ return rad ? 'A' + f(rad) + ' ' + f(rad) + ' 0 0 1 ' + f(ex) + ' ' + f(ey) : ''; };
  return 'M' + f(x+a) + ' ' + f(y) + 'H' + f(x+w-b) + arc(b, x+w, y+b) + 'V' + f(y+h-c) + arc(c, x+w-c, y+h)
       + 'H' + f(x+d) + arc(d, x, y+h-d) + 'V' + f(y+a) + arc(a, x+a, y) + 'Z';
}
const rr = (x, y, w, h, r) => rr4(x, y, w, h, [r,r,r,r]);
const circ = (cx, cy, r) => `M${f(cx-r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0Z`;
const diam = (x, y, s) => `M${f(x+s/2)} ${f(y)}L${f(x+s)} ${f(y+s/2)}L${f(x+s/2)} ${f(y+s)}L${f(x)} ${f(y+s/2)}Z`;

function eyeOuterPath(shape, x, y){
  switch(shape){
    case 'rounded': return rr(x,y,7,7,2) + rr(x+1,y+1,5,5,1.2);
    case 'extra':   return rr(x,y,7,7,3) + rr(x+1,y+1,5,5,2.2);
    case 'circle':  return circ(x+3.5,y+3.5,3.5) + circ(x+3.5,y+3.5,2.5);
    case 'leaf':    return rr4(x,y,7,7,[3,0,3,0]) + rr4(x+1,y+1,5,5,[2.2,0,2.2,0]);
    default:        return rr(x,y,7,7,0) + rr(x+1,y+1,5,5,0);
  }
}
function eyeInnerPath(shape, x, y){
  x += 2; y += 2;
  switch(shape){
    case 'rounded': return rr(x,y,3,3,0.9);
    case 'circle':  return circ(x+1.5,y+1.5,1.5);
    case 'leaf':    return rr4(x,y,3,3,[1.4,0,1.4,0]);
    case 'diamond': return diam(x-0.3,y-0.3,3.6);
    default:        return rr(x,y,3,3,0);
  }
}

/* ---------- 產生 SVG ---------- */
let GID = 0;
function build(text, st){
  const gid = 'qg' + (++GID) + Math.random().toString(36).slice(2, 6);
  st = Object.assign({}, DEFAULT, st || {});
  const order = ['L','M','Q','H'];
  let ec = order.indexOf(st.ec) < 0 ? 1 : order.indexOf(st.ec);
  if (st.logo) ec = Math.max(ec, (+st.logoSize || 0.22) > 0.22 ? 3 : 2); // 有 logo 時自動提高容錯
  const q = qrcode(0, order[ec]); q.addData(text || ' '); q.make();
  const n = q.getModuleCount(), Q = Math.max(1, Math.min(8, Math.round(+st.margin >= 0 ? +st.margin : 4))), S = n + Q*2;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c);
  const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n-7) || (r >= n-7 && c < 7);

  // logo 區
  let lg = null;
  if (st.logo){
    const sz = Math.max(5, Math.round(n * Math.min(0.3, Math.max(0.12, +st.logoSize || 0.22))));
    const lo = (n - sz) / 2;
    lg = { x: lo, y: lo, s: sz };
  }
  const covered = (r, c) => lg && (c + 0.5) > lg.x - 0.6 && (c + 0.5) < lg.x + lg.s + 0.6 && (r + 0.5) > lg.y - 0.6 && (r + 0.5) < lg.y + lg.s + 0.6;
  const on = (r, c) => dark(r, c) && !inEye(r, c) && !covered(r, c);

  // 點
  let d = '';
  const P = st.pattern;
  if (P === 'vbar' || P === 'hbar'){
    for (let a = 0; a < n; a++){
      let start = -1;
      for (let b = 0; b <= n; b++){
        const r = P === 'vbar' ? b : a, c = P === 'vbar' ? a : b;
        const isOn = b < n && on(r, c);
        if (isOn && start < 0) start = b;
        if (!isOn && start >= 0){
          const len = b - start;
          d += P === 'vbar' ? rr(Q+a+0.1, Q+start+0.05, 0.8, len-0.1, 0.4) : rr(Q+start+0.05, Q+a+0.1, len-0.1, 0.8, 0.4);
          start = -1;
        }
      }
    }
  } else {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
      if (!on(r, c)) continue;
      const x = Q + c, y = Q + r;
      switch(P){
        case 'small':   d += rr(x+0.12, y+0.12, 0.76, 0.76, 0); break;
        case 'rounded': d += rr(x+0.05, y+0.05, 0.9, 0.9, 0.3); break;
        case 'dot':     d += circ(x+0.5, y+0.5, 0.45); break;
        case 'diamond': d += diam(x-0.02, y-0.02, 1.04); break;
        case 'plus':    d += `M${x+0.3} ${y}h0.4v0.3h0.3v0.4h-0.3v0.3h-0.4v-0.3h-0.3v-0.4h0.3Z`; break;
        case 'classy':  d += rr4(x+0.04, y+0.04, 0.92, 0.92, [0.42,0,0.42,0]); break;
        case 'connected': {
          const u = on(r-1,c), dn = on(r+1,c), l = on(r,c-1), rt = on(r,c+1), R = 0.5;
          d += rr4(x, y, 1, 1, [(!u&&!l)?R:0, (!u&&!rt)?R:0, (!dn&&!rt)?R:0, (!dn&&!l)?R:0]); break;
        }
        default: d += `M${x} ${y}h1v1h-1Z`;
      }
    }
  }

  // 定位角
  let eo = '', ei = '';
  [[0,0],[0,n-7],[n-7,0]].forEach(([r, c]) => {
    eo += eyeOuterPath(st.eyeOuter, Q+c, Q+r);
    ei += eyeInnerPath(st.eyeInner, Q+c, Q+r);
  });

  // 填色
  const bgColor = st.transparent ? 'none' : st.bg;
  let defs = '', fill = st.fg;
  if (st.fill === 'linear' || st.fill === 'radial'){
    if (st.fill === 'linear'){
      const a = (+st.angle || 0) * Math.PI / 180, cx = S/2, cy = S/2, L = S/2;
      defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(cx-Math.cos(a)*L)}" y1="${f(cy-Math.sin(a)*L)}" x2="${f(cx+Math.cos(a)*L)}" y2="${f(cy+Math.sin(a)*L)}"><stop offset="0" stop-color="${st.fg}"/><stop offset="1" stop-color="${st.fg2}"/></linearGradient>`;
    } else {
      defs += `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${S/2}" cy="${S/2}" r="${f(S*0.6)}"><stop offset="0" stop-color="${st.fg}"/><stop offset="1" stop-color="${st.fg2}"/></radialGradient>`;
    }
    fill = `url(#${gid})`;
  }
  const eoFill = st.customEye ? st.eyeOuterColor : fill, eiFill = st.customEye ? st.eyeInnerColor : fill;

  let qr = '';
  qr += `<path d="${d}" fill="${fill}"/>`;
  qr += `<path d="${eo}" fill="${eoFill}" fill-rule="evenodd"/>`;
  qr += `<path d="${ei}" fill="${eiFill}"/>`;
  if (lg){
    const pad = 0.4, plateFill = st.transparent ? '#ffffff' : st.bg;
    if (st.logoPlate) qr += `<rect x="${f(Q+lg.x-pad)}" y="${f(Q+lg.y-pad)}" width="${f(lg.s+pad*2)}" height="${f(lg.s+pad*2)}" rx="${f(lg.s*0.18)}" fill="${plateFill}"/>`;
    const ins = st.logoPlate ? lg.s * 0.06 : 0;
    qr += `<image href="${st.logo}" xlink:href="${st.logo}" x="${f(Q+lg.x+ins)}" y="${f(Q+lg.y+ins)}" width="${f(lg.s-ins*2)}" height="${f(lg.s-ins*2)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // 外框
  const fr = st.frame, fc = st.frameColor, txt = escX(st.frameText || '');
  const font = `font-family='-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif' font-weight='700' text-anchor='middle'`;
  let W = S, H = S, body = '', ox = 0, oy = 0;
  const qrBg = `<rect width="${S}" height="${S}" fill="${bgColor}"/>`;

  if (fr === 'bottom' || fr === 'top'){
    const p = 1.6, bar = S * 0.2;
    W = S + p*2; H = S + p*2 + bar;
    oy = fr === 'top' ? p + bar : p; ox = p;
    const ty = fr === 'top' ? p + bar*0.55 : p + S + bar*0.45;
    body = `<rect width="${f(W)}" height="${f(H)}" rx="${f(S*0.07)}" fill="${fc}"/>`
         + `<rect x="${ox}" y="${f(oy)}" width="${S}" height="${S}" rx="${f(S*0.04)}" fill="${st.transparent ? '#ffffff' : st.bg}"/>`
         + `<text x="${f(W/2)}" y="${f(ty)}" dy="0.35em" font-size="${f(bar*0.46)}" fill="${ink(fc)}" ${font}>${txt}</text>`;
  } else if (fr === 'bubble'){
    const p = 1.2, gap = S*0.06, bar = S*0.17, tri = S*0.05;
    W = S + p*2; H = S + p*2 + gap + bar;
    ox = p; oy = p;
    const by = S + p*2 + gap;
    body = `<rect x="${f(p*0.4)}" y="${f(p*0.4)}" width="${f(W-p*0.8)}" height="${f(S+p*1.2)}" rx="${f(S*0.05)}" fill="${st.transparent ? '#ffffff' : st.bg}" stroke="${fc}" stroke-width="${f(p*0.8)}"/>`
         + `<path d="M${f(W/2-tri)} ${f(by+0.01)}L${f(W/2)} ${f(by-tri)}L${f(W/2+tri)} ${f(by+0.01)}Z" fill="${fc}"/>`
         + `<rect x="${f(S*0.12)}" y="${f(by)}" width="${f(W-S*0.24)}" height="${f(bar)}" rx="${f(bar/2)}" fill="${fc}"/>`
         + `<text x="${f(W/2)}" y="${f(by+bar/2)}" dy="0.35em" font-size="${f(bar*0.5)}" fill="${ink(fc)}" ${font}>${txt}</text>`;
  } else if (fr === 'circle'){
    const R = S * 0.74, ring = S * 0.05;
    W = H = R*2; ox = R - S/2; oy = R - S/2 - S*0.06;
    body = `<circle cx="${f(R)}" cy="${f(R)}" r="${f(R)}" fill="${fc}"/>`
         + `<circle cx="${f(R)}" cy="${f(R)}" r="${f(R-ring)}" fill="${st.transparent ? '#ffffff' : st.bg}"/>`
         + `<text x="${f(R)}" y="${f(oy+S+(R*2-oy-S)*0.42)}" dy="0.35em" font-size="${f(S*0.085)}" fill="${fc}" ${font}>${txt}</text>`;
  } else if (fr === 'outline'){
    const p = 1.6, bar = S*0.16;
    W = S + p*2; H = S + p*2 + bar; ox = p; oy = p;
    body = `<rect x="0.3" y="0.3" width="${f(W-0.6)}" height="${f(H-0.6)}" rx="${f(S*0.06)}" fill="${st.transparent ? 'none' : st.bg}" stroke="${fc}" stroke-width="0.6"/>`
         + `<text x="${f(W/2)}" y="${f(p+S+bar*0.4)}" dy="0.35em" font-size="${f(bar*0.5)}" fill="${fc}" ${font}>${txt}</text>`;
  }

  const inner = (fr === 'none' ? qrBg : '') + qr;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W*10)}" height="${f(H*10)}">`
    + (defs ? `<defs>${defs}</defs>` : '')
    + body
    + `<g transform="translate(${f(ox)} ${f(oy)})">${inner}</g></svg>`;
  return { svg, w: W, h: H, n };
}

function toPNG(text, st, width, jpg){
  const b = build(text, st);
  const scale = (width || 1200) / b.w;
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(b.w * scale); c.height = Math.round(b.h * scale);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      if (jpg){ x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.95));
    };
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.svg);
  });
}

function warnings(st){
  st = Object.assign({}, DEFAULT, st || {});
  const bg = st.transparent ? '#ffffff' : st.bg;
  const cols = [st.fg].concat(st.fill !== 'solid' ? [st.fg2] : []).concat(st.customEye ? [st.eyeOuterColor, st.eyeInnerColor] : []);
  const worst = Math.min.apply(null, cols.map(c => contrast(c, bg)));
  if (worst < 3) return '⚠️ 顏色對比太低，可能掃不到';
  if (cols.some(c => lum(c) > lum(bg))) return '⚠️ 淺色點配深色底，部分手機可能掃不到';
  if (st.transparent) return '透明背景：請放在淺色底上使用';
  return '';
}

function normalize(st){ // 相容舊版設定
  st = Object.assign({}, st || {});
  if (st.dot){ st.pattern = {round:'rounded', dot:'dot', square:'square'}[st.dot] || 'square'; delete st.dot; }
  if (st.eye){ st.eyeOuter = {round:'rounded', circle:'circle'}[st.eye] || 'square'; st.eyeInner = {round:'rounded', circle:'circle'}[st.eye] || 'square'; delete st.eye; }
  if (st.eyeColor){ if (st.eyeColor.toLowerCase() !== (st.fg || '#000000').toLowerCase()){ st.customEye = true; st.eyeOuterColor = st.eyeInnerColor = st.eyeColor; } delete st.eyeColor; }
  if (st.cta !== undefined){ st.frameText = st.cta; delete st.cta; }
  return Object.assign({}, DEFAULT, st);
}

/* ---------- 編輯器 ---------- */
const CSS = `
.qx{font-size:14px}
.qx-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid #e6e3dc;margin-bottom:12px;-webkit-overflow-scrolling:touch}
.qx-tabs button{background:none;border:0;border-bottom:3px solid transparent;color:#666;padding:9px 12px;font:inherit;white-space:nowrap;cursor:pointer;border-radius:0}
.qx-tabs button.on{color:#3d6b5a;border-bottom-color:#3d6b5a;font-weight:700}
.qx-pane{display:none}.qx-pane.on{display:block}
.qx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
.qx-opt{background:#fff;border:2px solid #e6e3dc;border-radius:10px;padding:6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:#555}
.qx-opt.on{border-color:#3d6b5a;background:#f1f7f4;color:#2a4a3e;font-weight:700}
.qx-opt svg{width:100%;height:auto;max-width:72px}
.qx-row{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;margin:10px 0}
.qx-row label{color:#555}
.qx input[type=color]{width:56px;height:36px;padding:2px;border:1px solid #e6e3dc;border-radius:8px;background:#fff}
.qx input[type=text]{width:100%;padding:8px 10px;border:1px solid #e6e3dc;border-radius:8px;font:inherit}
.qx input[type=range]{width:100%}
.qx-seg{display:flex;flex-wrap:wrap;gap:6px}
.qx-seg button{background:#fff;color:#2b2b2b;border:1px solid #e6e3dc;border-radius:8px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer}
.qx-seg button.on{background:#3d6b5a;color:#fff;border-color:#3d6b5a}
.qx-h{font-weight:700;margin:14px 0 6px;color:#333}
.qx-note{color:#888;font-size:12px;margin-top:6px}
.qx-logo{display:flex;gap:10px;align-items:center}
.qx-logo .pv{width:56px;height:56px;border:1px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fafafa}
.qx-logo .pv img{max-width:100%;max-height:100%}
`;

function editor(root, opts){
  if (!document.getElementById('qx-css')){ const s = document.createElement('style'); s.id = 'qx-css'; s.textContent = CSS; document.head.appendChild(s); }
  let st = normalize(opts.style);
  const sampleText = 'https://example.com/qr';
  const thumb = patch => build(sampleText, Object.assign({}, DEFAULT, {frame:'none'}, patch)).svg;
  const eyeThumb = (outer, inner) => `<svg viewBox="-0.5 -0.5 8 8"><path d="${eyeOuterPath(outer||'square',0,0)}" fill="#222" fill-rule="evenodd"/><path d="${eyeInnerPath(inner||'square',0,0)}" fill="#222"/></svg>`;
  const patThumb = p => {
    const b = build('QX', Object.assign({}, DEFAULT, {pattern:p}));
    return b.svg.replace(/viewBox="[^"]+"/, `viewBox="13 13 9 7"`);
  };

  const opt = (key, val, label, svg) => `<div class="qx-opt" data-k="${key}" data-v="${val}">${svg}<span>${label}</span></div>`;
  const seg = (key, items) => `<div class="qx-seg" data-k="${key}">${items.map(([v,l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;

  root.classList.add('qx');
  root.innerHTML = `
    <div class="qx-tabs">
      <button type="button" data-t="tpl" class="on">範本</button><button type="button" data-t="pat">圖樣</button>
      <button type="button" data-t="eye">定位角</button><button type="button" data-t="col">顏色</button>
      <button type="button" data-t="logo">Logo</button><button type="button" data-t="frame">外框</button>
    </div>
    <div class="qx-pane on" data-p="tpl"><div class="qx-grid">${TEMPLATES.map(([name, p], i) => `<div class="qx-opt" data-tpl="${i}">${thumb(Object.assign({frameText:'SCAN'}, p))}<span>${name}</span></div>`).join('')}</div>
      <div class="qx-note">套用範本會覆蓋目前的樣式（logo 會保留）。</div></div>
    <div class="qx-pane" data-p="pat"><div class="qx-grid">${PATTERNS.map(([v,l]) => opt('pattern', v, l, patThumb(v))).join('')}</div>
      <div class="qx-h">點的密度（容錯率）</div>
      ${seg('ec', [['L','最疏'],['M','標準'],['Q','較密'],['H','最密']])}
      <div class="qx-note">越疏點越少、越好掃，但比較不耐髒污折損；加 logo 時會自動調到「較密」以上。網址越短，點也會越少。</div>
      <div class="qx-h">四周留白</div>
      <div class="qx-row" style="margin:4px 0"><label data-mlabel></label><input type="range" min="1" max="8" step="1" data-r="margin"></div>
      <div class="qx-note">建議至少 2 格，印刷時旁邊有其他圖文就留 4 格。</div>
    </div>
    <div class="qx-pane" data-p="eye">
      <div class="qx-h">外框</div><div class="qx-grid">${EYE_OUTER.map(([v,l]) => opt('eyeOuter', v, l, eyeThumb(v, 'square'))).join('')}</div>
      <div class="qx-h">內心</div><div class="qx-grid">${EYE_INNER.map(([v,l]) => opt('eyeInner', v, l, eyeThumb('square', v))).join('')}</div>
    </div>
    <div class="qx-pane" data-p="col">
      <div class="qx-row"><label>填色方式</label>${seg('fill', [['solid','單色'],['linear','線性漸層'],['radial','放射漸層']])}</div>
      <div class="qx-row"><label>主色</label><input type="color" data-c="fg"></div>
      <div class="qx-row qx-g"><label>漸層色</label><input type="color" data-c="fg2"></div>
      <div class="qx-row qx-gl"><label>漸層方向</label>${seg('angle', [['0','→'],['45','↘'],['90','↓'],['135','↙']])}</div>
      <div class="qx-row"><label>定位角配色</label>${seg('customEye', [['false','同主色'],['true','自訂']])}</div>
      <div class="qx-row qx-e"><label>定位角外框</label><input type="color" data-c="eyeOuterColor"></div>
      <div class="qx-row qx-e"><label>定位角內心</label><input type="color" data-c="eyeInnerColor"></div>
      <div class="qx-row"><label>背景</label><input type="color" data-c="bg"></div>
      <div class="qx-row"><label>透明背景</label>${seg('transparent', [['false','否'],['true','是']])}</div>
    </div>
    <div class="qx-pane" data-p="logo">
      <div class="qx-logo"><div class="pv" data-logopv></div>
        <div class="qx-seg"><button type="button" data-act="pick">上傳圖片</button><button type="button" data-act="rm">移除</button></div>
        <input type="file" accept="image/*" data-file style="display:none"></div>
      <div class="qx-row"><label>大小</label><input type="range" min="0.12" max="0.3" step="0.02" data-r="logoSize"></div>
      <div class="qx-row"><label>logo 底板</label>${seg('logoPlate', [['true','有'],['false','無']])}</div>
      <div class="qx-note">加 logo 後會自動提高容錯率。logo 不要太大，下載後請實際掃描測試。</div>
    </div>
    <div class="qx-pane" data-p="frame">
      <div class="qx-grid">${FRAMES.map(([v,l]) => opt('frame', v, l, thumb({frame:v, frameText:'SCAN'}))).join('')}</div>
      <div class="qx-row"><label>外框顏色</label><input type="color" data-c="frameColor"></div>
      <div class="qx-row"><label>文字</label><input type="text" maxlength="18" data-tx="frameText" placeholder="例：掃我看更多"></div>
    </div>`;

  const $$ = s => root.querySelectorAll(s);
  function sync(){
    $$('.qx-opt[data-k]').forEach(o => o.classList.toggle('on', String(st[o.dataset.k]) === o.dataset.v));
    $$('.qx-seg[data-k] button').forEach(b => b.classList.toggle('on', String(st[b.parentNode.dataset.k]) === b.dataset.v));
    $$('[data-c]').forEach(i => i.value = st[i.dataset.c]);
    $$('[data-r]').forEach(i => i.value = st[i.dataset.r]);
    $$('[data-tx]').forEach(i => { if (document.activeElement !== i) i.value = st[i.dataset.tx]; });
    $$('.qx-g').forEach(e => e.style.display = st.fill === 'solid' ? 'none' : '');
    $$('.qx-gl').forEach(e => e.style.display = st.fill === 'linear' ? '' : 'none');
    $$('.qx-e').forEach(e => e.style.display = st.customEye ? '' : 'none');
    root.querySelector('[data-mlabel]').textContent = st.margin + ' 格';
    root.querySelector('[data-logopv]').innerHTML = st.logo ? `<img src="${st.logo}">` : '<span style="color:#bbb;font-size:12px">無</span>';
  }
  const fire = () => { sync(); opts.onChange && opts.onChange(Object.assign({}, st)); };
  const parse = v => v === 'true' ? true : v === 'false' ? false : (/^\d+$/.test(v) ? +v : v);

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-t]');
    if (t){ $$('.qx-tabs button').forEach(b => b.classList.toggle('on', b === t)); $$('.qx-pane').forEach(p => p.classList.toggle('on', p.dataset.p === t.dataset.t)); return; }
    const tp = e.target.closest('[data-tpl]');
    if (tp){ const logo = st.logo, size = st.logoSize, txt = st.frameText; st = Object.assign({}, DEFAULT, TEMPLATES[+tp.dataset.tpl][1], {logo, logoSize:size, frameText: txt}); return fire(); }
    const o = e.target.closest('.qx-opt[data-k]');
    if (o){ st[o.dataset.k] = o.dataset.v; if (o.dataset.k === 'frame' && o.dataset.v !== 'none' && !st.frameText) st.frameText = 'SCAN ME'; return fire(); }
    const b = e.target.closest('.qx-seg[data-k] button');
    if (b){ st[b.parentNode.dataset.k] = parse(b.dataset.v); return fire(); }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'pick') root.querySelector('[data-file]').click();
    if (act && act.dataset.act === 'rm'){ st.logo = ''; fire(); }
  });
  root.addEventListener('input', e => {
    const i = e.target;
    if (i.dataset.c){ st[i.dataset.c] = i.value; fire(); }
    if (i.dataset.r){ st[i.dataset.r] = +i.value; fire(); }
    if (i.dataset.tx !== undefined){ st[i.dataset.tx] = i.value; fire(); }
  });
  root.querySelector('[data-file]').addEventListener('change', e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = opts.logoMax || 600, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/png');
        if (opts.logoLimit && url.length > opts.logoLimit) url = c.toDataURL('image/jpeg', 0.85);
        st.logo = url; fire();
      };
      img.onerror = () => alert('無法讀取這張圖片');
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });

  sync();
  return {
    get: () => Object.assign({}, st),
    set: s => { st = normalize(s); sync(); }
  };
}

window.QRX = { DEFAULT, build, toPNG, warnings, normalize, editor };
})();
