// ==== refs
const plan = document.getElementById('plan');
const statusEl = document.getElementById('status');

const in_wm = document.getElementById('in_wm');
const in_hm = document.getElementById('in_hm');
const in_grid = document.getElementById('in_grid');
const in_scale = document.getElementById('in_scale');

const btnRedraw = document.getElementById('btnRedraw');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const btnClear = document.getElementById('btnClear');
const btnExportJSON = document.getElementById('btnExportJSON');
const btnExportPNG = document.getElementById('btnExportPNG');

const palette = document.getElementById('palette');

const sel_type = document.getElementById('sel_type');
const sel_x = document.getElementById('sel_x');
const sel_y = document.getElementById('sel_y');
const sel_w = document.getElementById('sel_w');
const sel_h = document.getElementById('sel_h');
const sel_rot = document.getElementById('sel_rot');
const btnApply = document.getElementById('btnApply');
const btnRotate = document.getElementById('btnRotate');
const btnDelete = document.getElementById('btnDelete');

// ==== state
let SCALE = 20, GRID_M = 1, WIDTH_M = 20, HEIGHT_M = 12;
let modules = [];
let selId = null;

// ==== utils
const clamp = (x,a,b)=> Math.max(a, Math.min(b,x));
const snap = m => Math.round(m/GRID_M)*GRID_M;
function uid(){ return Math.random().toString(36).slice(2,9); }
const m2px = m => m*SCALE;
const px2m = px => px/SCALE;
const svgNS = ()=>'http://www.w3.org/2000/svg';
function svgRect(x,y,w,h,cls){ const el=document.createElementNS(svgNS(),'rect'); el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('width',w);el.setAttribute('height',h); if(cls)el.setAttribute('class',cls); return el;}
function svgLine(x1,y1,x2,y2,cls){ const el=document.createElementNS(svgNS(),'line'); el.setAttribute('x1',x1);el.setAttribute('y1',y1);el.setAttribute('x2',x2);el.setAttribute('y2',y2); if(cls)el.setAttribute('class',cls); return el;}
function svgText(x,y,text,cls){ const el=document.createElementNS(svgNS(),'text'); el.setAttribute('x',x); el.setAttribute('y',y); if(cls)el.setAttribute('class',cls); el.textContent=text; return el; }
function status(t){ statusEl.textContent=t; setTimeout(()=>statusEl.textContent='Pronto',2000); }

// ==== grid
function redrawPlan(){
  WIDTH_M  = Math.max(4, Number(in_wm.value)||20);
  HEIGHT_M = Math.max(4, Number(in_hm.value)||12);
  GRID_M   = Math.max(0.25, Number(in_grid.value)||1);
  SCALE    = Math.max(5, Number(in_scale.value)||20);

  const W = m2px(WIDTH_M), H = m2px(HEIGHT_M);
  plan.setAttribute('viewBox', `0 0 ${W} ${H}`);
  plan.innerHTML = '';

  plan.appendChild(svgRect(0,0,W,H,'floor'));
  for (let x=0;x<=WIDTH_M;x+=GRID_M) plan.appendChild(svgLine(m2px(x),0,m2px(x),H,'gridline'));
  for (let y=0;y<=HEIGHT_M;y+=GRID_M) plan.appendChild(svgLine(0,m2px(y),W,m2px(y),'gridline'));

  modules.forEach(m=>{
    m.x = clamp(m.x,0,Math.max(0,WIDTH_M - (m.rot%180===0? m.w : m.h)));
    m.y = clamp(m.y,0,Math.max(0,HEIGHT_M - (m.rot%180===0? m.h : m.w)));
  });
  renderModules();
  status('Planta redesenhada');
}

// ==== helpers label
function ensureDefs(svg){
  let defs = svg.querySelector('defs');
  if (!defs){
    defs = document.createElementNS(svgNS(), 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  return defs;
}

// auto-shrink robusto (largura + altura + ellipsis)
function fitLabel(labelEl, fullText, maxW, maxH){
  // tamanho inicial proporcional à altura do cabeçalho
  let fs = Math.max(6, Math.min(16, Math.floor(maxH * 0.65)));
  labelEl.textContent = fullText;
  labelEl.setAttribute('font-size', fs);
  labelEl.setAttribute('stroke','none'); // garante sem contorno

  // encolhe até caber (largura e altura)
  let guard = 0;
  while (guard++ < 40) {
    const w = labelEl.getComputedTextLength();
    const h = labelEl.getBBox().height;
    if (w <= maxW && h <= maxH) break;
    fs -= 1;
    if (fs < 6) { fs = 6; break; } // mínimo seguro p/ módulos 2×2
    labelEl.setAttribute('font-size', fs);
  }

  // se ainda não couber na largura, abrevia + reticências
  if (labelEl.getComputedTextLength() > maxW) {
    const shortMap = { 'Higiene':'Hig.', 'Convivência':'Conv.', 'Laboratório':'Lab.', 'Armazém':'Arm.' };
    const parts = fullText.split(' ');
    const type = parts.shift() || '';
    const rest = parts.join(' ');
    let txt = (shortMap[type] || type) + ' ' + rest;

    labelEl.textContent = txt;
    while (txt.length > 3 && labelEl.getComputedTextLength() > maxW) {
      txt = txt.slice(0, -1);
      labelEl.textContent = txt + '…';
    }
  }
}

// ==== render (com clip + auto-shrink)
function renderModules(){
  const W = m2px(WIDTH_M), H = m2px(HEIGHT_M);
  plan.innerHTML = '';

  plan.appendChild(svgRect(0,0,W,H,'floor'));
  for (let x=0;x<=WIDTH_M;x+=GRID_M) plan.appendChild(svgLine(m2px(x),0,m2px(x),H,'gridline'));
  for (let y=0;y<=HEIGHT_M;y+=GRID_M) plan.appendChild(svgLine(0,m2px(y),W,m2px(y),'gridline'));

  const defs = ensureDefs(plan);

  modules.forEach(m=>{
    const group = document.createElementNS(svgNS(),'g');
    group.setAttribute('data-id', m.id);
    group.setAttribute('class', `module${m.id===selId?' selected':''}`);

    const wpx = m2px(m.w), hpx = m2px(m.h);
    const xpx = m2px(m.x), ypx = m2px(m.y);
    group.setAttribute('transform', `translate(${xpx},${ypx}) rotate(${m.rot},${wpx/2},${hpx/2})`);

    // corpo
    const rect = svgRect(0,0,wpx,hpx);
    rect.setAttribute('fill', m.color||'#6fa8dc');
    rect.setAttribute('rx', 8);
    group.appendChild(rect);

    // cabeçalho
    const pad = 4;
    const badgeW = Math.max(36, wpx - pad*2);
    const badgeH = clamp(Math.round(hpx*0.22), 16, 34);
    const badgeX = pad, badgeY = pad;

    const badge = svgRect(badgeX,badgeY,badgeW,badgeH,'badge');
    group.appendChild(badge);

    // clip para o texto (impede vazar do badge)
    const clipId = `clip-${m.id}`;
    let clip = document.getElementById(clipId);
    if (!clip){
      clip = document.createElementNS(svgNS(),'clipPath');
      clip.setAttribute('id', clipId);
      defs.appendChild(clip);
    }
    clip.innerHTML = '';
    clip.appendChild(svgRect(badgeX,badgeY,badgeW,badgeH));

    // texto centralizado
    const fullText = `${m.label} ${m.w}×${m.h}m`;
    const cx = badgeX + badgeW/2, cy = badgeY + badgeH/2;
    const label = svgText(cx, cy, fullText, 'module-label');
    label.setAttribute('text-anchor','middle');
    label.setAttribute('dominant-baseline','middle');
    label.setAttribute('clip-path', `url(#${clipId})`);
    label.setAttribute('stroke','none'); // não herda stroke do grupo
    group.appendChild(label);

    // auto-ajuste
    fitLabel(label, fullText, badgeW - 6, badgeH - 4);

    // tooltip
    const tt = document.createElementNS(svgNS(),'title');
    tt.textContent = fullText;
    label.appendChild(tt);

    // handlers
    attachDragHandlers(group, m.id);
    group.addEventListener('mousedown', ()=>selectModule(m.id));
    group.addEventListener('touchstart', ()=>selectModule(m.id), {passive:true});

    plan.appendChild(group);
  });
}

// ==== seleção / inspetor
function selectModule(id){
  selId = id;
  const m = modules.find(x=>x.id===id);
  if (!m) return;
  sel_type.value = m.type;
  sel_x.value = m.x; sel_y.value = m.y;
  sel_w.value = m.w; sel_h.value = m.h;
  sel_rot.value = m.rot;
  renderModules();
}
btnApply.addEventListener('click', ()=>{
  if (!selId) return;
  const m = modules.find(x=>x.id===selId); if(!m) return;
  m.x = clamp(Number(sel_x.value)||0,0,WIDTH_M);
  m.y = clamp(Number(sel_y.value)||0,0,HEIGHT_M);
  m.w = Math.max(0.5, Number(sel_w.value)||m.w);
  m.h = Math.max(0.5, Number(sel_h.value)||m.h);
  m.rot = ((Number(sel_rot.value)||0)%360+360)%360;
  keepInside(m); renderModules();
});
btnRotate.addEventListener('click', ()=>{
  if (!selId) return;
  const m = modules.find(x=>x.id===selId);
  m.rot = (m.rot + 90) % 360; keepInside(m);
  sel_rot.value = m.rot; renderModules();
});
btnDelete.addEventListener('click', ()=>{
  if (!selId) return;
  modules = modules.filter(x=>x.id!==selId);
  selId=null; clearInspector(); renderModules();
});
function clearInspector(){ sel_type.value = sel_x.value = sel_y.value = sel_w.value = sel_h.value = sel_rot.value = ''; }
function keepInside(m){
  const w = (m.rot%180===0 ? m.w : m.h);
  const h = (m.rot%180===0 ? m.h : m.w);
  m.x = clamp(m.x, 0, Math.max(0, WIDTH_M - w));
  m.y = clamp(m.y, 0, Math.max(0, HEIGHT_M - h));
}

// ==== drag
function attachDragHandlers(group,id){
  let start=null;
  const onDown = e=>{
    e.preventDefault();
    const pt = getPoint(e); const m = modules.find(x=>x.id===id);
    start = {id, offX: pt.x - m.x, offY: pt.y - m.y};
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('touchend', onUp);
  };
  const onMove = e=>{
    if(!start) return; e.preventDefault();
    const m = modules.find(x=>x.id===start.id);
    const pt = getPoint(e);
    m.x = snap(pt.x - start.offX);
    m.y = snap(pt.y - start.offY);
    keepInside(m);
    if (m.id===selId){ sel_x.value=m.x; sel_y.value=m.y; }
    renderModules();
  };
  const onUp = ()=>{
    start=null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  };
  group.addEventListener('mousedown', onDown);
  group.addEventListener('touchstart', onDown, {passive:false});
}
function getPoint(e){
  const p = ('touches' in e && e.touches.length)? e.touches[0] : e;
  const rect = plan.getBoundingClientRect();
  const x = (p.clientX-rect.left) * (plan.viewBox.baseVal.width/rect.width);
  const y = (p.clientY-rect.top)  * (plan.viewBox.baseVal.height/rect.height);
  return { x: px2m(x), y: px2m(y) };
}
window.addEventListener('keydown', (e)=>{
  if (e.key.toLowerCase()==='r' && selId){
    const m = modules.find(x=>x.id===selId);
    m.rot=(m.rot+90)%360; keepInside(m);
    sel_rot.value=m.rot; renderModules();
  }
});

// ==== paleta
palette.querySelectorAll('.mod').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    addModule(btn.dataset.type, Number(btn.dataset.w), Number(btn.dataset.h), btn.dataset.color);
  });
});
function addModule(type,w,h,color){
  const mod = { id:uid(), type, label:titleFromType(type), x:1, y:1, w, h, rot:0, color };
  keepInside(mod); modules.push(mod); selectModule(mod.id);
}
function titleFromType(t){
  const map = { sleep:'Sleep', galley:'Kitchen', lab:'Lab', farm:'Garden', hygiene:'Bath', storage:'Storage', common:'Social' };
  return map[t] || t;
}

// ==== salvar / carregar / exportar
const KEY='hab_layout_v1';
function saveLayout(){
  const data = { width_m:WIDTH_M,height_m:HEIGHT_M,grid_m:GRID_M,scale:SCALE,modules };
  localStorage.setItem(KEY, JSON.stringify(data)); status('Layout salvo ✅');
}
function loadLayout(){
  const raw = localStorage.getItem(KEY); if(!raw) return status('Nada salvo');
  const d = JSON.parse(raw);
  WIDTH_M=d.width_m; in_wm.value=WIDTH_M;
  HEIGHT_M=d.height_m; in_hm.value=HEIGHT_M;
  GRID_M=d.grid_m; in_grid.value=GRID_M;
  SCALE=d.scale; in_scale.value=SCALE;
  modules=d.modules||[]; selId=null; clearInspector(); redrawPlan(); status('Layout carregado 📦');
}
function clearAll(){ modules=[]; selId=null; clearInspector(); redrawPlan(); status('Tudo limpo'); }
function exportJSON(){
  const payload = localStorage.getItem(KEY) || JSON.stringify({width_m:WIDTH_M,height_m:HEIGHT_M,grid_m:GRID_M,scale:SCALE,modules},null,2);
  const blob = new Blob([payload],{type:'application/json'});
  const url = URL.createObjectURL(blob); download(url,'habitat-layout.json');
}
function exportPNG(){
  const xml = new XMLSerializer().serializeToString(plan);
  const dataUrl = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
  const img = new Image();
  img.onload=()=>{
    const W=plan.viewBox.baseVal.width, H=plan.viewBox.baseVal.height;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
    c.toBlob(b=>download(URL.createObjectURL(b),'habitat-layout.png'));
  };
  img.src=dataUrl;
}
function download(url,filename){ const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }

// ==== init
btnRedraw.addEventListener('click', redrawPlan);
btnSave.addEventListener('click', saveLayout);
btnLoad.addEventListener('click', loadLayout);
btnClear.addEventListener('click', clearAll);
btnExportJSON.addEventListener('click', exportJSON);
btnExportPNG.addEventListener('click', exportPNG);

redrawPlan();
status('Pronto! Clique em um módulo para adicionar, arraste para posicionar, “R” para girar.');
