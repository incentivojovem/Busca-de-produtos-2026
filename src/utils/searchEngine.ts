import { DataRow, RecordCategory, SearchResultItem, ClientPrintFields, ClientExtraFields } from '../types';

export const fields: Record<RecordCategory, string[]> = {
  produtos: ['Código', 'Descrição', 'Preço', 'Estoque', 'Unidade', 'Categoria', 'Marca', 'Código de Barras'],
  clientes: ['Código', 'Razão Social', 'Nome Fantasia', 'CNPJ', 'Telefone', 'Endereço', 'Bairro', 'Cidade', 'UF', 'Vendedor', 'Limite de Crédito']
};

export const aliases: Record<string, string[]> = {
  'Código': ['Código', 'CODIGO', 'CÓDIGO', 'COD', 'ID', 'ID CLIENTE', 'COD CLIENTE', 'CODIGO CLIENTE', 'COD PRODUTO', 'ID PRODUTO'],
  'Descrição': ['Descrição', 'DESCRIÇÃO', 'DESCRICAO', 'Produto', 'PRODUTO', 'Nome', 'NOME', 'Nome do Produto', 'DESCRIÇÃO DO PRODUTO'],
  'Preço': ['Preço', 'PREÇO', 'PRECO', 'Preço Venda', 'PREÇO VENDA', 'VALOR', 'Valor'],
  'Estoque': ['Estoque', 'ESTOQUE', 'Qtd', 'QTD', 'Quantidade', 'QUANTIDADE'],
  'Unidade': ['Unidade', 'UNIDADE', 'UN', 'UND'],
  'Categoria': ['Categoria', 'CATEGORIA', 'Grupo', 'GRUPO'],
  'Marca': ['Marca', 'MARCA'],
  'Código de Barras': ['Código de Barras', 'CODIGO DE BARRAS', 'EAN', 'GTIN', 'BARRAS'],
  'Razão Social': ['Razão Social', 'RAZÃO SOCIAL', 'RAZAO SOCIAL', 'Cliente', 'CLIENTE', 'Nome', 'NOME', 'Empresa', 'EMPRESA'],
  'Nome Fantasia': ['Nome Fantasia', 'NOME FANTASIA', 'Fantasia', 'FANTASIA'],
  'CNPJ': ['CNPJ', 'CPF/CNPJ', 'CPF', 'DOCUMENTO', 'DOCUMENTO FISCAL'],
  'Telefone': ['Telefone', 'TELEFONE', 'Fone', 'FONE', 'Celular', 'CELULAR'],
  'Endereço': ['Endereço', 'ENDEREÇO', 'ENDERECO', 'Logradouro', 'LOGRADOURO', 'Rua', 'RUA', 'Avenida', 'AVENIDA'],
  'Bairro': ['Bairro', 'BAIRRO', 'Bairro/Distrito', 'BAIRRO/DISTRITO', 'Distrito', 'DISTRITO'],
  'Cidade': ['Cidade', 'CIDADE', 'Município', 'MUNICIPIO', 'MUNICÍPIO'],
  'UF': ['UF', 'Estado', 'ESTADO'],
  'Vendedor': ['Vendedor', 'VENDEDOR', 'VEND', 'Representante', 'REPRESENTANTE', 'Consultor', 'CONSULTOR', 'Atendente', 'ATENDENTE'],
  'Limite de Crédito': ['Limite de Crédito', 'LIMITE DE CRÉDITO', 'LIMITE DE CREDITO', 'Limite', 'LIMITE']
};

export const normalize = (s: any): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const esc = (s: any): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));

export const norm = (v: any): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const compact = (v: any): string => norm(v).replace(/[^a-z0-9]/g, '');

export function allowedStatus(s: string): boolean {
  s = normalize(s).replace(/\s/g, '');
  return ['adm', 'admin', 'administrador', 'adm02', 'adm2', 'ativo', 'aprovado', 'liberado', 'comum', 'user', 'usuario'].includes(s);
}

export function cleanData(doc: { id: string; data?: () => any }, cat: RecordCategory): DataRow | null {
  const x = (typeof doc.data === 'function' ? doc.data() : doc) || {};
  const payload = x.data && typeof x.data === 'object' ? x.data : x;
  const row: DataRow = {
    ...payload,
    _docId: x.docId || doc.id,
    _sheetTitle: x.sheetTitle || '',
    _category: cat,
    _groupName: x.groupName || ''
  };
  return Object.keys(payload).length ? row : null;
}

export function buildHeaders(rows: DataRow[], metaHeaders?: string[]): string[] {
  const base = Array.isArray(metaHeaders) ? metaHeaders.filter(h => !String(h).startsWith('_')) : [];
  const discovered = rows.flatMap(r => Object.keys(r).filter(k => !k.startsWith('_')));
  return Array.from(new Set([...base, ...discovered]));
}

export function valueByLabels(row: DataRow, labels: string[]): string {
  const keys = Object.keys(row || {});
  const wanted = labels.map(normalize);
  let k = keys.find(x => wanted.includes(normalize(x)));
  if (!k) {
    k = keys.find(x => wanted.some(w => normalize(x).includes(w) || w.includes(normalize(x))));
  }
  return k ? String(row[k] ?? '').trim() : '';
}

export function calculateRelevance(query: string, value: string): number {
  if (!query || !value) return 0;
  const rawQ = String(query).trim().toLowerCase();
  const rawV = String(value).trim().toLowerCase();
  if (rawV === rawQ) return 100;
  if (rawV.startsWith(rawQ)) return 95;
  if (rawQ.length >= 2 && rawV.includes(rawQ)) return 90;

  const q = normalize(query);
  const v = normalize(value);
  if (!q || !v) return 0;
  if (v === q) return 100;
  if (v.startsWith(q)) return 95;
  if (v.includes(q)) return 90;

  const qw = q.split(' ').filter(Boolean);
  const vw = v.split(' ').filter(Boolean);
  let hits = 0;
  let pos = 0;

  for (let i = 0; i < qw.length; i++) {
    const idx = vw.findIndex(w => w === qw[i] || w.startsWith(qw[i]) || (qw[i].length > 2 && w.includes(qw[i])));
    if (idx !== -1) {
      hits++;
      if (i === 0 && idx === 0) pos += 5;
    }
  }

  if (hits) {
    const ratio = hits / qw.length;
    if (ratio === 1) {
      const pen = Math.max(0, vw.length - qw.length) * 1.5;
      return Math.min(98, Math.round(Math.max(75, 95 - pen + pos)));
    }
    const pen = Math.max(0, vw.length - qw.length) * 0.5;
    return Math.min(85, Math.round(Math.max(15, ratio * 75 - pen + pos)));
  }

  if (q.length >= 3 && v.length <= 120) {
    const bg = (s: string) => {
      const set = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };
    const a = bg(q);
    const b = bg(v);
    let n = 0;
    a.forEach(x => {
      if (b.has(x)) n++;
    });
    const score = Math.round((2 * n) / (a.size + b.size) * 85);
    if (score >= 35) return score;
  }
  return 0;
}

export function extractQuantity(q: string): { quantidade: number | null; limpo: string } {
  const text = String(q || '').trim();
  const m = text.match(/^(\d+)\s*(?:x|un|cx|pct|pc|und|unidades|unidade|garrafas|latas|lata|pcts|kg)?\s+(.+)$/i);
  return m ? { quantidade: parseInt(m[1], 10), limpo: m[2].trim() } : { quantidade: null, limpo: text };
}

export function scoreRow(row: DataRow, cat: RecordCategory, query: string): SearchResultItem | null {
  let final = query;
  let qty: number | null = null;
  if (cat === 'produtos') {
    const p = extractQuantity(query);
    final = p.limpo;
    qty = p.quantidade;
  }
  if (!final) return null;

  const nq = final.toLowerCase().trim();
  const cq = nq.replace(/[^a-z0-9]/g, '');
  let max = 0;
  const matched: { field: string; value: string; score: number }[] = [];
  const keys = Object.keys(row).filter(k => !k.startsWith('_'));

  for (const h of keys) {
    const val = String(row[h] ?? '').trim();
    if (!val) continue;
    let s = 0;
    if (cat === 'produtos') {
      s = calculateRelevance(final, val);
    } else {
      const nv = val.toLowerCase().trim();
      const cv = nv.replace(/[^a-z0-9]/g, '');
      if (nv === nq) s = 100;
      else if (cq && cv === cq) s = 95;
      else if (nv.startsWith(nq)) s = 80;
      else if (cq && cv.startsWith(cq)) s = 75;
      else if (nv.includes(nq)) s = 50;
      else if (cq && cv.includes(cq)) s = 45;
    }
    if (s > 0) {
      max = Math.max(max, s);
      matched.push({ field: h, value: val, score: s });
    }
  }

  if (max > 0) {
    return {
      category: cat,
      record: row,
      score: max,
      quantidade: qty,
      matchedFields: matched.sort((a, b) => b.score - a.score)
    };
  }
  return null;
}

export function getProductCode(r: DataRow, prodHeaders: string[] = []): string {
  return valueByLabels(r, ['Código', 'CODIGO', 'CÓDIGO', 'COD', 'ID', 'ID PRODUTO', 'COD PRODUTO']) || String(r[prodHeaders[1]] ?? r['Código'] ?? '');
}

export function getClientCode(r: DataRow, clientHeaders: string[] = []): string {
  return valueByLabels(r, ['Código', 'CODIGO', 'CÓDIGO', 'COD', 'ID', 'ID CLIENTE', 'COD CLIENTE']) || String(r[clientHeaders[1]] ?? r['Código'] ?? '');
}

export function getName(item: { category: RecordCategory; record: DataRow }, prodHeaders: string[] = [], clientHeaders: string[] = []): string {
  if (item.category === 'produtos') {
    return valueByLabels(item.record, ['Descrição', 'DESCRIÇÃO', 'DESCRICAO', 'Produto', 'PRODUTO', 'Nome', 'NOME']) || String(item.record[prodHeaders[0]] ?? item.record['Descrição'] ?? 'Produto');
  }
  return (
    valueByLabels(item.record, ['Razão Social', 'RAZÃO SOCIAL', 'RAZAO SOCIAL', 'Cliente', 'CLIENTE', 'Nome', 'NOME', 'Empresa', 'EMPRESA']) ||
    valueByLabels(item.record, ['Nome Fantasia', 'NOME FANTASIA', 'Fantasia', 'FANTASIA']) ||
    String(item.record[clientHeaders[0]] ?? item.record['Razão Social'] ?? 'Cliente')
  );
}

export function clientExtras(r: DataRow): ClientExtraFields {
  const cnpj = valueByLabels(r, ['CNPJ', 'CPF/CNPJ', 'CPF', 'DOCUMENTO']);
  const bairro = valueByLabels(r, ['Bairro', 'BAIRRO', 'Bairro/Distrito', 'BAIRRO/DISTRITO', 'Distrito', 'DISTRITO']);
  const fantasia = valueByLabels(r, ['Nome Fantasia', 'NOME FANTASIA', 'Fantasia', 'FANTASIA']);
  return { cnpj, bairro, fantasia };
}

export function highlightText(text: string, q: string): string {
  const s = String(text ?? '');
  const term = String(q || '').trim();
  if (!term) return esc(s);
  const idx = normalize(s).indexOf(normalize(term));
  if (idx < 0) return esc(s);
  return esc(s.slice(0, idx)) + '<mark>' + esc(s.slice(idx, idx + term.length)) + '</mark>' + esc(s.slice(idx + term.length));
}

function findValue(row: DataRow, headers: string[], keys: string[], fallback: number): string {
  const found = Object.keys(row).find(k => keys.some(pk => k.trim().toUpperCase() === pk.trim().toUpperCase()));
  if (found && String(row[found] ?? '').trim()) return String(row[found]).trim();
  if (headers[fallback] && String(row[headers[fallback]] ?? '').trim()) return String(row[headers[fallback]]).trim();
  const vals = Object.values(row).filter((_, i) => !Object.keys(row)[i].startsWith('_'));
  return vals[fallback] !== undefined ? String(vals[fallback]).trim() : '';
}

export function clientFields(item: { record: DataRow }, clientHeaders: string[] = []): ClientPrintFields {
  const r = item.record;
  const h = clientHeaders;
  return {
    code: findValue(r, h, ['CÓDIGO', 'CODIGO', 'COD', 'ID', 'ID CLIENTE', 'COD CLIENTE'], 1) || String(r['Código'] || ''),
    razao: findValue(r, h, ['RAZÃO SOCIAL', 'RAZAO SOCIAL', 'CLIENTE', 'NOME', 'NOME/RAZÃO SOCIAL', 'NOME / RAZÃO SOCIAL', 'EMPRESA'], 0) || String(r['Razão Social'] || ''),
    cnpj: findValue(r, h, ['CNPJ', 'CPF/CNPJ', 'CPF', 'DOCUMENTO'], 2) || String(r['CNPJ'] || ''),
    address: findValue(r, h, ['ENDEREÇO', 'ENDERECO', 'LOGRADOURO', 'RUA', 'AVENIDA'], 3) || String(r['Endereço'] || ''),
    bairro: findValue(r, h, ['BAIRRO', 'BAIRRO/DISTRITO', 'DISTRITO'], 4) || String(r['Bairro'] || ''),
    vendedor: findValue(r, h, ['VENDEDOR', 'VEND', 'REPRESENTANTE', 'VENDEDOR(A)', 'CONSULTOR', 'ATENDENTE'], 9) || String(r['Vendedor'] || ''),
    date: new Date().toLocaleDateString('pt-BR')
  };
}

export function qrUrl(code: string): string {
  const loginUrl = 'https://incentivojovem.github.io/Buscadeprodutos/';
  return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(loginUrl);
}

export async function getQrImage(code: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = qrUrl(code);
  });
}

export async function generateCardCanvas(f: ClientPrintFields): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1780;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1780, 1080);

  // Outer border
  const bw = 10;
  ctx.lineWidth = bw;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(5, 5, 1770, 1070);

  // Header black band
  const hh = 170;
  ctx.fillStyle = '#000';
  ctx.fillRect(5, 5, 1770, hh);

  // SF White icon box
  ctx.fillStyle = '#fff';
  ctx.fillRect(40, 35, 100, 100);
  ctx.fillStyle = '#000';
  ctx.font = '900 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SF', 90, 85);

  // Header Title
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 46px sans-serif';
  ctx.fillText('SUPERFÁCIL ATACADO', 165, 80);

  ctx.fillStyle = '#d1d5db';
  ctx.font = '800 24px sans-serif';
  ctx.fillText('FICHA DE IDENTIFICAÇÃO DO CLIENTE', 165, 120);

  // Issue date
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('EMISSÃO', 1735, 75);
  ctx.fillStyle = '#fff';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(f.date || '---', 1735, 120);

  // Side bar
  const side = 500, bodyTop = 175, bodyH = 900 - 10;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(5, bodyTop, side, bodyH);

  ctx.beginPath();
  ctx.moveTo(505, bodyTop);
  ctx.lineTo(505, bodyTop + bodyH);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4b5563';
  ctx.font = '900 26px sans-serif';
  ctx.fillText('CÓDIGO', 255, 235);

  // Code box
  const boxY = 260, boxW = 420, boxH = 95, boxX = 45;
  ctx.fillStyle = '#fff';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#000';
  const dc = f.code || '---';
  ctx.font = dc.length > 10 ? '900 36px monospace' : dc.length > 8 ? '900 44px monospace' : '900 56px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(dc, 255, boxY + 47);

  // QR box
  const qy = 400, qs = 340, qx = 85;
  ctx.fillStyle = '#fff';
  ctx.fillRect(qx, qy, qs, qs);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(qx, qy, qs, qs);

  const qi = await getQrImage(f.code || '');
  if (qi && qi.naturalWidth > 0) {
    ctx.drawImage(qi, qx + 25, qy + 20, qs - 50, qs - 80);
  }

  ctx.fillStyle = '#000';
  ctx.font = '900 22px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ACESSE O SITE', 255, qy + qs - 20);

  // Right details
  const rx = 550, maxW = 1180;
  ctx.textAlign = 'left';

  function drawField(label: string, value: string, y: number, size: number) {
    if (!ctx) return;
    ctx.fillStyle = '#4b5563';
    ctx.font = '900 24px sans-serif';
    ctx.fillText(label, rx, y);
    ctx.fillStyle = '#000';
    ctx.font = '900 ' + size + 'px sans-serif';
    const text = (value || 'NÃO INFORMADO').toUpperCase();
    if (ctx.measureText(text).width <= maxW) {
      ctx.fillText(text, rx, y + size + 6);
      return;
    }
    const words = text.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const w of words) {
      const test = (line + ' ' + w).trim();
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, rx, y + size + 6 + i * (size + 12)));
  }

  drawField('RAZÃO SOCIAL', f.razao, 230, 40);
  drawField('BAIRRO', f.bairro, 415, 36);
  drawField('ENDEREÇO', f.address, 570, 32);
  drawField('VENDEDOR', f.vendedor, 725, 34);

  // Footer bar
  const ft = 965;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(5, ft, 1770, 110);
  ctx.beginPath();
  ctx.moveTo(5, ft);
  ctx.lineTo(1775, ft);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.stroke();

  ctx.fillStyle = '#374151';
  ctx.font = '900 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SELO DE CADASTRO HOMOLOGADO', 45, 1020);

  ctx.fillStyle = '#059669';
  ctx.textAlign = 'right';
  ctx.fillText('✓ CLIENTE VERIFICADO', 1735, 1020);

  return canvas.toDataURL('image/png');
}

export async function triggerPrintCard(
  f: ClientPrintFields,
  onAfterPrint?: () => void
): Promise<boolean> {
  const png = await generateCardCanvas(f);
  if (!png) return false;

  let callbackCalled = false;
  const notifyCompletion = () => {
    if (!callbackCalled) {
      callbackCalled = true;
      if (onAfterPrint) {
        try {
          onAfterPrint();
        } catch (err) {
          console.error('Error in onAfterPrint callback:', err);
        }
      }
    }
  };

  const messageHandler = (e: MessageEvent) => {
    if (e.data && e.data.type === 'FICHA_PRINT_COMPLETED') {
      window.removeEventListener('message', messageHandler);
      notifyCompletion();
    }
  };
  window.addEventListener('message', messageHandler);

  const w = window.open('', '_blank', 'width=1000,height=750');
  if (!w) {
    // If popup blocked, create printable iframe or direct trigger
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha de Identificação - ${esc(f.code || 'Cliente')}</title><style>@page{size:landscape;margin:0}*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:#fff;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}.print-card-image{width:15.2cm;height:auto;max-width:96vw;max-height:96vh;object-fit:contain;display:block;margin:auto}</style></head><body><img class="print-card-image" src="${png}" alt="Ficha"><script>window.addEventListener('afterprint',function(){try{if(window.parent)window.parent.postMessage({type:'FICHA_PRINT_COMPLETED'},'*');}catch(e){}});<\/script></body></html>`);
      doc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          printFrame.remove();
          notifyCompletion();
        }, 1500);
      }, 300);
      return true;
    }
    return false;
  }

  const code = esc(f.code || 'Cliente');
  w.document.open();
  w.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Ficha de Identificação - ${code}</title>
  <style>
    @page { size: landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      background: #fff;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .print-card-image {
      width: 15.2cm;
      height: auto;
      max-width: 96vw;
      max-height: 96vh;
      object-fit: contain;
      display: block;
      margin: auto;
    }
  </style>
</head>
<body>
  <img class="print-card-image" src="${png}" alt="Ficha de Identificação - ${code}">
  <script>
    var completed = false;
    function finalizePrint() {
      if (completed) return;
      completed = true;
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'FICHA_PRINT_COMPLETED', code: '${code}' }, '*');
        }
      } catch (err) {}
      setTimeout(function() {
        try { window.close(); } catch(e) {}
      }, 150);
    }

    // Modern browsers fire afterprint when user prints or cancels print dialog
    window.addEventListener('afterprint', finalizePrint);

    // Trigger print automatically after document rendering
    setTimeout(function() {
      window.focus();
      try {
        window.print();
      } catch(e) {
        console.error('Print trigger error:', e);
      }
    }, 350);
  <\/script>
</body>
</html>`);
  w.document.close();

  // Watch popup window in case user closes it manually or afterprint completes
  const watcher = setInterval(() => {
    try {
      if (!w || w.closed) {
        clearInterval(watcher);
        window.removeEventListener('message', messageHandler);
        notifyCompletion();
      }
    } catch {
      clearInterval(watcher);
      window.removeEventListener('message', messageHandler);
      notifyCompletion();
    }
  }, 300);

  // Safety cleanup timeout
  setTimeout(() => {
    clearInterval(watcher);
    window.removeEventListener('message', messageHandler);
  }, 60000);

  return true;
}

export function rowValue(row: DataRow, label: string): string {
  const keys = aliases[label] || [label];
  const all = Object.keys(row || {});
  const exact = all.find(k => keys.some(a => norm(k) === norm(a)));
  if (exact) return String(row[exact] ?? '').trim();
  const partial = all.find(k => keys.some(a => norm(k).includes(norm(a)) || norm(a).includes(norm(k))));
  return partial ? String(row[partial] ?? '').trim() : '';
}

export function rowName(row: DataRow, recordCat: RecordCategory): string {
  return recordCat === 'produtos'
    ? rowValue(row, 'Descrição') || rowValue(row, 'Código') || 'Produto'
    : rowValue(row, 'Razão Social') || rowValue(row, 'Nome Fantasia') || rowValue(row, 'Código') || 'Cliente';
}

export function lookupScore(row: DataRow, q: string, recordCat: RecordCategory): number {
  const nq = norm(q);
  const cq = compact(q);
  if (!nq) return 0;
  const vals: [string, string, number][] = [
    ['Código', rowValue(row, 'Código'), 120],
    ['CNPJ', rowValue(row, 'CNPJ'), 120],
    [recordCat === 'produtos' ? 'Descrição' : 'Razão Social', rowValue(row, recordCat === 'produtos' ? 'Descrição' : 'Razão Social'), 100],
    [recordCat === 'produtos' ? 'Código de Barras' : 'Nome Fantasia', rowValue(row, recordCat === 'produtos' ? 'Código de Barras' : 'Nome Fantasia'), 90],
    ['Telefone', rowValue(row, 'Telefone'), 70]
  ];
  let best = 0;
  vals.forEach(([_, v, weight]) => {
    const nv = norm(v);
    const cv = compact(v);
    if (!nv) return;
    if (nv === nq || cv === cq) best = Math.max(best, weight);
    else if (nv.startsWith(nq) || cv.startsWith(cq)) best = Math.max(best, weight - 15);
    else if (nv.includes(nq) || cv.includes(cq)) best = Math.max(best, weight - 35);
  });
  return best;
}

export function checkDuplicate(
  data: Record<string, string>,
  recordCat: RecordCategory,
  rows: DataRow[],
  excludeDocId?: string | null
): { label: string; row: DataRow } | null {
  const checks: [string, string | undefined][] = [
    ['Código', data['Código']],
    recordCat === 'produtos' ? ['Código de Barras', data['Código de Barras']] : ['CNPJ', data['CNPJ']]
  ];
  for (const [label, val] of checks) {
    if (!val) continue;
    const nv = compact(val);
    const found = rows.find(r => String(r._docId) !== String(excludeDocId) && compact(rowValue(r, label)) === nv);
    if (found) return { label, row: found };
  }
  return null;
}

export function generateSearchTokens(data: Record<string, any>): string[] {
  return Array.from(
    new Set(
      Object.values(data)
        .map(v => String(v ?? ''))
        .flatMap(v => norm(v).split(/[^a-z0-9]+/).filter(x => x.length >= 2))
    )
  ).slice(0, 500);
}

export function findExistingKey(obj: Record<string, any>, label: string): string {
  const keys = aliases[label] || [label];
  const ks = Object.keys(obj || {});
  return (
    ks.find(k => keys.some(a => norm(k) === norm(a))) ||
    ks.find(k => keys.some(a => norm(k).includes(norm(a)) || norm(a).includes(norm(k)))) ||
    label
  );
}

// Sample fallback database for instantaneous testing and demonstration
export const sampleProducts: DataRow[] = [
  {
    _docId: 'prd-sample-1',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1001',
    'Descrição': 'ARROZ TIPO 1 5KG CAMIL PACOTE',
    'Preço': 'R$ 29,90',
    'Estoque': '450',
    'Unidade': 'PCT',
    'Categoria': 'Mercearia',
    'Marca': 'Camil',
    'Código de Barras': '7896006700018'
  },
  {
    _docId: 'prd-sample-2',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1002',
    'Descrição': 'FEIJAO CARIOCA 1KG TIO JOAO',
    'Preço': 'R$ 8,75',
    'Estoque': '620',
    'Unidade': 'PCT',
    'Categoria': 'Mercearia',
    'Marca': 'Tio João',
    'Código de Barras': '7896006700025'
  },
  {
    _docId: 'prd-sample-3',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1003',
    'Descrição': 'OLEO DE SOJA 900ML LIZA PET',
    'Preço': 'R$ 6,49',
    'Estoque': '1200',
    'Unidade': 'UN',
    'Categoria': 'Mercearia',
    'Marca': 'Liza',
    'Código de Barras': '7896006700032'
  },
  {
    _docId: 'prd-sample-4',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1004',
    'Descrição': 'REFRIGERANTE COCA-COLA 2L PET',
    'Preço': 'R$ 9,99',
    'Estoque': '840',
    'Unidade': 'UN',
    'Categoria': 'Bebidas',
    'Marca': 'Coca-Cola',
    'Código de Barras': '7894900011517'
  },
  {
    _docId: 'prd-sample-5',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1005',
    'Descrição': 'DETERGENTE LIQUIDO NEUTRO 500ML YPE',
    'Preço': 'R$ 2,59',
    'Estoque': '980',
    'Unidade': 'UN',
    'Categoria': 'Limpeza',
    'Marca': 'Ypê',
    'Código de Barras': '7891038000010'
  },
  {
    _docId: 'prd-sample-6',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1006',
    'Descrição': 'SABAO EM PO OMO LAVAGEM PERFEITA 1.6KG',
    'Preço': 'R$ 21,90',
    'Estoque': '340',
    'Unidade': 'CX',
    'Categoria': 'Limpeza',
    'Marca': 'Omo',
    'Código de Barras': '7891038000027'
  },
  {
    _docId: 'prd-sample-7',
    _category: 'produtos',
    _sheetTitle: 'Produtos',
    _groupName: 'default',
    'Código': 'PRD-1007',
    'Descrição': 'CAFE TORRADO E MOIDO PILAO 500G VACUO',
    'Preço': 'R$ 18,90',
    'Estoque': '510',
    'Unidade': 'PCT',
    'Categoria': 'Matinais',
    'Marca': 'Pilão',
    'Código de Barras': '7896006700070'
  }
];

export const sampleClients: DataRow[] = [
  {
    _docId: 'cli-sample-1',
    _category: 'clientes',
    _sheetTitle: 'Clientes',
    _groupName: 'default',
    'Código': 'CLI-5001',
    'Razão Social': 'SUPERMERCADO ESTRELA DA ALVORADA LTDA',
    'Nome Fantasia': 'SUPERMERCADO ESTRELA',
    'CNPJ': '12.345.678/0001-90',
    'Telefone': '(11) 98765-4321',
    'Endereço': 'AVENIDA BRASIL, 1500',
    'Bairro': 'CENTRO',
    'Cidade': 'SÃO PAULO',
    'UF': 'SP',
    'Vendedor': 'CARLOS SILVA',
    'Limite de Crédito': 'R$ 50.000,00'
  },
  {
    _docId: 'cli-sample-2',
    _category: 'clientes',
    _sheetTitle: 'Clientes',
    _groupName: 'default',
    'Código': 'CLI-5002',
    'Razão Social': 'MERCADINHO E PADARIA SAO JORGE ME',
    'Nome Fantasia': 'PADARIA SAO JORGE',
    'CNPJ': '98.765.432/0001-10',
    'Telefone': '(11) 97654-3210',
    'Endereço': 'RUA DAS FLORES, 340',
    'Bairro': 'JARDIM PAULISTA',
    'Cidade': 'SÃO PAULO',
    'UF': 'SP',
    'Vendedor': 'MARIANA SOUZA',
    'Limite de Crédito': 'R$ 20.000,00'
  },
  {
    _docId: 'cli-sample-3',
    _category: 'clientes',
    _sheetTitle: 'Clientes',
    _groupName: 'default',
    'Código': 'CLI-5003',
    'Razão Social': 'DISTRIBUIDORA DE BEBIDAS NOVA ERA EIRELI',
    'Nome Fantasia': 'DEPOSITO NOVA ERA',
    'CNPJ': '33.444.555/0001-22',
    'Telefone': '(21) 99887-7665',
    'Endereço': 'RODOVIA PRESIDENTE DUTRA, KM 120',
    'Bairro': 'DISTRITO INDUSTRIAL',
    'Cidade': 'RIO DE JANEIRO',
    'UF': 'RJ',
    'Vendedor': 'ROBERTO ALVES',
    'Limite de Crédito': 'R$ 85.000,00'
  },
  {
    _docId: 'cli-sample-4',
    _category: 'clientes',
    _sheetTitle: 'Clientes',
    _groupName: 'default',
    'Código': 'CLI-5004',
    'Razão Social': 'COMERCIAL DE ALIMENTOS BOA ESPERANCA LTDA',
    'Nome Fantasia': 'SUPERMERCADO BOA ESPERANCA',
    'CNPJ': '45.111.222/0001-33',
    'Telefone': '(31) 98877-6655',
    'Endereço': 'AVENIDA AMAZONAS, 2100',
    'Bairro': 'PRADO',
    'Cidade': 'BELO HORIZONTE',
    'UF': 'MG',
    'Vendedor': 'FERNANDA LIMA',
    'Limite de Crédito': 'R$ 40.000,00'
  }
];
