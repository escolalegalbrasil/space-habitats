// ===== Elementos da página (HTML) =====
const shapeSel = document.getElementById('shape');   // seletor de forma
const in_r     = document.getElementById('in_r');     // raio "r" (m)
const in_h     = document.getElementById('in_h');     // altura "h" (m) ou parte reta (na cápsula)
const in_R     = document.getElementById('in_R');     // raio maior "R" (toro)
const in_m3pp  = document.getElementById('in_m3pp');  // m³ por pessoa
const out_vol  = document.getElementById('out_vol');  // saída volume
const out_floor= document.getElementById('out_floor');// saída área de piso
const out_cap  = document.getElementById('out_cap');  // saída capacidade
const viz      = document.getElementById('viz');      // SVG para preview

// Rótulos que vamos mostrar/ocultar conforme a forma escolhida
const lbl_R = document.getElementById('lbl_R'); // campo R (apenas para toro)
const lbl_r = document.getElementById('lbl_r');
const lbl_h = document.getElementById('lbl_h');

// ===== Helpers (funções utilitárias) =====
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function fmt(n, digits=2){ return Number(n).toLocaleString('pt-BR', {maximumFractionDigits:digits}); }

// Desenha algo simples no SVG para visualizar a forma (sem escala real)
function drawPreview(shape, r, h, R){
  // Limpamos o SVG
  viz.innerHTML = '';

  // Criamos um grupo <g> centralizado
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('transform','translate(200,100)');
  viz.appendChild(g);

  if (shape === 'cylinder'){
    // Cilindro: retângulo (corpo) + semicírculos (topo/base estilizados)
    const w = clamp(r*10, 20, 160); // largura simulada (px)
    const hh= clamp(h*5, 20, 160);  // altura simulada (px)

    // corpo
    const rect = document.createElementNS(g.namespaceURI,'rect');
    rect.setAttribute('x', -w/2);
    rect.setAttribute('y', -hh/2);
    rect.setAttribute('width', w);
    rect.setAttribute('height', hh);
    rect.setAttribute('rx', 10);
    rect.setAttribute('fill', '#1f406a');
    g.appendChild(rect);

    // bordas superior/inferior (efeito)
    const top = document.createElementNS(g.namespaceURI,'ellipse');
    top.setAttribute('cx', 0);
    top.setAttribute('cy', -hh/2);
    top.setAttribute('rx', w/2);
    top.setAttribute('ry', 8);
    top.setAttribute('fill', '#2a5b99');
    g.appendChild(top);

    const bottom = document.createElementNS(g.namespaceURI,'ellipse');
    bottom.setAttribute('cx', 0);
    bottom.setAttribute('cy', hh/2);
    bottom.setAttribute('rx', w/2);
    bottom.setAttribute('ry', 8);
    bottom.setAttribute('fill', '#173455');
    g.appendChild(bottom);
  }
  else if (shape === 'torus'){
    // Toro: círculo externo - círculo interno (donut)
    const Rpx = clamp(R*4, 40, 90); // raio maior em px
    const rpx = clamp(r*3, 15, 50); // raio do "tubo" em px

    const outer = document.createElementNS(g.namespaceURI,'circle');
    outer.setAttribute('cx', 0);
    outer.setAttribute('cy', 0);
    outer.setAttribute('r', Rpx + rpx);
    outer.setAttribute('fill', '#1f406a');
    g.appendChild(outer);

    const inner = document.createElementNS(g.namespaceURI,'circle');
    inner.setAttribute('cx', 0);
    inner.setAttribute('cy', 0);
    inner.setAttribute('r', Math.max(1, Rpx - rpx));
    inner.setAttribute('fill', '#0f1726');
    g.appendChild(inner);
  }
  else { // 'capsule'
    // Cápsula inflável: retângulo + semicírculos nas extremidades
    const w = clamp(r*10, 20, 120); // usa r para "espessura"
    const hh= clamp(h*5, 20, 160);  // parte reta

    // parte reta
    const rect = document.createElementNS(g.namespaceURI,'rect');
    rect.setAttribute('x', -w/2);
    rect.setAttribute('y', -hh/2);
    rect.setAttribute('width', w);
    rect.setAttribute('height', hh);
    rect.setAttribute('fill', '#1f406a');
    g.appendChild(rect);

    // meias-esferas (estilizadas como elipses)
    const top = document.createElementNS(g.namespaceURI,'ellipse');
    top.setAttribute('cx', 0);
    top.setAttribute('cy', -hh/2);
    top.setAttribute('rx', w/2);
    top.setAttribute('ry', w/2);
    top.setAttribute('fill', '#2a5b99');
    g.appendChild(top);

    const bottom = document.createElementNS(g.namespaceURI,'ellipse');
    bottom.setAttribute('cx', 0);
    bottom.setAttribute('cy', hh/2);
    bottom.setAttribute('rx', w/2);
    bottom.setAttribute('ry', w/2);
    bottom.setAttribute('fill', '#173455');
    g.appendChild(bottom);
  }
}

// ===== Fórmulas de volume e área de piso =====
// Área de piso (aproximação): usamos "área da seção" como piso básico.
// - Cilindro: piso ~ área do círculo: π r²
// - Toro: piso ~ circunferência central * largura do tubo (2πR * 2r) → aproximado em m²
// - Cápsula: piso ~ área do círculo: π r² (considerando um "anel" de passagem simplificado)

function floorArea_m2(shape, r, h, R){
  const pi = Math.PI;
  if (shape === 'cylinder'){
    return pi * r * r;
  } else if (shape === 'torus'){
    return 2 * pi * R * (2 * r); // perímetro do círculo central * "largura" do tubo
  } else { // capsule
    return pi * r * r;
  }
}

function volume_m3(shape, r, h, R){
  const pi = Math.PI;
  if (shape === 'cylinder'){
    // V = π r² h
    return pi * r * r * h;
  } else if (shape === 'torus'){
    // V ≈ 2 π² R r²
    return 2 * Math.PI * Math.PI * R * r * r;
  } else { 
    // capsule: V ≈ cilindro + 2 meias-esferas = π r² h + (4/3) π r³
    return (pi * r * r * h) + ((4/3) * pi * r * r * r);
  }
}

// Capacidade = volume / m³_por_pessoa (arredonda pra baixo)
function capacity_people(vol_m3, m3_per_person){
  if (m3_per_person <= 0) return 0;
  return Math.floor(vol_m3 / m3_per_person);
}

// ===== Atualiza telas quando algo muda =====
function recalc(){
  // Pega valores numéricos dos inputs
  const shape = shapeSel.value;
  const r = Math.max(1, Number(in_r.value));
  const h = Math.max(1, Number(in_h.value));
  const R = Math.max(1, Number(in_R.value));
  const m3pp = Math.max(1, Number(in_m3pp.value));

  // Mostra/esconde campo R (só no toro)
  lbl_R.style.display = (shape === 'torus') ? 'flex' : 'none';
  // Para o toro, h não é usado no volume, mas mantemos para consistência da UI
  lbl_h.querySelector('span')?.remove; // (no-op; apenas ilustrativo)

  // Calcula
  const V = volume_m3(shape, r, h, R);
  const A = floorArea_m2(shape, r, h, R);
  const C = capacity_people(V, m3pp);

  // Atualiza as saídas
  out_vol.textContent   = fmt(V, 2);
  out_floor.textContent = fmt(A, 2);
  out_cap.textContent   = String(C);

  // Desenha preview (didático)
  drawPreview(shape, r, h, R);
}

// ===== Presets para testar rápido =====
const presets = {
  cylinder: { shape:'cylinder', r:6, h:12, R:15, m3pp:40 },
  torus:    { shape:'torus',    r:4, h:10, R:18, m3pp:40 },
  capsule:  { shape:'capsule',  r:5, h:8,  R:15, m3pp:40 }
};

document.querySelectorAll('.presets button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const key = btn.dataset.preset;
    const p = presets[key];
    shapeSel.value = p.shape;
    in_r.value = p.r;
    in_h.value = p.h;
    in_R.value = p.R;
    in_m3pp.value = p.m3pp;
    recalc();
  });
});

// Quando o usuário muda algo, recalcula
[shapeSel, in_r, in_h, in_R, in_m3pp].forEach(el=>{
  el.addEventListener('input', recalc);
});

// Inicializa a tela
recalc();

