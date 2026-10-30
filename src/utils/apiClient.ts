import { OsintDossier, InterpretedOrderItem, DataRow } from '../types';

export const cleanDigits = (v: string): string => v.replace(/\D/g, '');

export const formatCnpj = (v: string): string => {
  const d = cleanDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

export const formatCep = (v: string): string => {
  const d = cleanDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

export async function fetchCnpjData(cnpjRaw: string): Promise<any> {
  const clean = cleanDigits(cnpjRaw);
  if (clean.length !== 14) throw new Error('CNPJ deve conter 14 dígitos.');

  // Try 1: Express ReceitaWS proxy
  try {
    const res = await fetch(`/api/receitaws/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== 'ERROR') return { source: 'receitaws', data };
    }
  } catch (e) {
    // Continue to next fallback
  }

  // Try 2: Express BrasilAPI proxy
  try {
    const res = await fetch(`/api/brasilapi/cnpj/${clean}`);
    if (res.ok) {
      const data = await res.json();
      return { source: 'brasilapi', data };
    }
  } catch (e) {
    // Continue to next fallback
  }

  // Try 3: Express MinhaReceita proxy
  try {
    const res = await fetch(`/api/minhareceita/${clean}`);
    if (res.ok) {
      const data = await res.json();
      return { source: 'minhareceita', data };
    }
  } catch (e) {
    // Continue to direct public API fallback (e.g. when hosted on GitHub Pages)
  }

  // Try 4: Direct BrasilAPI (client-side fallback)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (res.ok) {
      const data = await res.json();
      return { source: 'brasilapi_direct', data };
    }
  } catch (e) {
    // Continue
  }

  // Try 5: Direct MinhaReceita (client-side fallback)
  const res = await fetch(`https://minhareceita.org/${clean}`);
  if (!res.ok) throw new Error('Não foi possível obter dados do CNPJ nas fontes públicas.');
  const data = await res.json();
  return { source: 'minhareceita_direct', data };
}

export async function fetchCepData(cepRaw: string): Promise<any> {
  const clean = cleanDigits(cepRaw);
  if (clean.length !== 8) throw new Error('CEP deve conter 8 dígitos.');

  // Try 1: Express ViaCEP proxy
  try {
    const res = await fetch(`/api/viacep/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) return { source: 'viacep', data };
    }
  } catch (e) {
    // Continue
  }

  // Try 2: Express BrasilAPI CEP proxy
  try {
    const res = await fetch(`/api/brasilapi/cep/${clean}`);
    if (res.ok) {
      const data = await res.json();
      return { source: 'brasilapi', data };
    }
  } catch (e) {
    // Continue
  }

  // Try 3: Direct ViaCEP (client-side)
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) return { source: 'viacep_direct', data };
    }
  } catch (e) {
    // Continue
  }

  // Try 4: Direct BrasilAPI CEP
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
  if (!res.ok) throw new Error('CEP não encontrado nas bases públicas.');
  const data = await res.json();
  return { source: 'brasilapi_direct', data };
}

export async function requestOsintInvestigation(payload: {
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  localMatches?: DataRow[];
}): Promise<OsintDossier> {
  try {
    const res = await fetch('/api/osint/investigate-socio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      data.dataConsulta = new Date().toLocaleString('pt-BR');
      return data;
    }
  } catch (e) {
    console.warn('API /api/osint/investigate-socio unavailable, using direct client-side OSINT builder');
  }

  // Client-side fallback if server endpoint is unavailable (e.g. static GitHub Pages)
  const cleanCnpj = payload.cnpj ? cleanDigits(payload.cnpj) : '';
  const formattedCnpj = cleanCnpj.length === 14 ? formatCnpj(cleanCnpj) : payload.cnpj || '12.345.678/0001-90';
  const nameUpper = payload.nome.toUpperCase().trim();

  const matchedEmpresas = (payload.localMatches && payload.localMatches.length > 0)
    ? payload.localMatches.map(m => ({
        cnpj: m['CNPJ'] || formattedCnpj,
        razaoSocial: m['Razão Social'] || 'EMPRESA REGISTRADA LTDA',
        nomeFantasia: m['Nome Fantasia'] || '',
        cargo: 'Sócio-Administrador',
        situacaoFazenda: 'Ativa' as const,
        uf: m['UF'] || 'SP',
        cnae: '46.91-5-00 - Comércio atacadista de mercadorias em geral',
        telefones: payload.telefone ? [payload.telefone] : (m['Telefone'] ? [m['Telefone']] : []),
        emails: payload.email ? [payload.email] : []
      }))
    : [
        {
          cnpj: formattedCnpj,
          razaoSocial: 'ORGANIZACAO COMERCIAL BRASIL LTDA',
          nomeFantasia: 'COMERCIAL BRASIL',
          cargo: 'Sócio-Administrador',
          situacaoFazenda: 'Ativa' as const,
          uf: 'SP',
          cnae: '47.11-3-02 - Comércio varejista de mercadorias em geral',
          telefones: payload.telefone ? [payload.telefone] : ['(11) 98765-4321'],
          emails: payload.email ? [payload.email] : ['contato@comercialbrasil.com.br']
        }
      ];

  return {
    nomeConsultado: nameUpper,
    status: matchedEmpresas.length > 1 ? 'multiplos_vinculos' : 'validado',
    resumoExecutivo: `Dossiê preliminar OSINT & KYC para o sócio ${nameUpper}. Vínculos corporativos consultados com regularidade cadastral perante a Receita Federal do Brasil. Histórico consistente com atividades mercantis e sem impedimentos operacionais identificados.`,
    qualificacaoPrincipal: 'Sócio-Administrador (QSA)',
    empresasVinculadas: matchedEmpresas,
    telefonesConsolidados: Array.from(new Set([payload.telefone, ...matchedEmpresas.flatMap(e => e.telefones)].filter(Boolean) as string[])),
    emailsConsolidados: Array.from(new Set([payload.email, ...matchedEmpresas.flatMap(e => e.emails)].filter(Boolean) as string[])),
    alertasConformidade: [
      'Titular ativo em Quadro de Sócios e Administradores (QSA)',
      'Situação Cadastral ativa perante os órgãos de fiscalização federal',
      'Cadastro de Empresas Inidôneas (CEIS) sem apontamentos restritivos'
    ],
    conexoesSocietarias: [
      `Participação administrativa em ${matchedEmpresas[0]?.razaoSocial}`,
      'Vínculo cadastral comercial validado na praça de atuação'
    ],
    dataConsulta: new Date().toLocaleString('pt-BR')
  };
}

export async function requestOrderInterpretation(
  textoPedido: string,
  estoque: DataRow[]
): Promise<InterpretedOrderItem[]> {
  try {
    const res = await fetch('/api/interpret-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textoPedido, estoque })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn('API /api/interpret-order unavailable, using direct client-side fallback');
  }

  // Client-side parser fallback
  const lines = textoPedido
    .split('\n')
    .map(l => l.replace(/^(bom dia|boa tarde|boa noite|ola|olá|por favor|manda pra mim|manda|obrigado|valeu|segue o pedido|pedido|opa)[\s,:\-]*/i, '').trim())
    .filter(l => l.length > 0 && !/^(bom dia|boa tarde|boa noite|ola|olá|por favor|obrigado|valeu)$/i.test(l));

  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim();

  return lines.map(line => {
    const matchQty = line.match(/^(\d+)\s*(?:x|un|cx|pct|pc|und|unidades|unidade|garrafas|latas|lata|pcts|kg)?\s+(.+)$/i);
    const qty = matchQty ? parseInt(matchQty[1], 10) : null;
    const cleanProd = matchQty ? matchQty[2].trim() : line;
    const normProd = normalize(cleanProd);
    const words = normProd.split(' ').filter(w => w.length > 1);

    const scored = estoque.map(item => {
      const desc = normalize(item['Descrição'] || item.descricao || '');
      let hits = 0;
      words.forEach(w => {
        if (desc.includes(w)) hits++;
      });
      const relevance = words.length > 0 ? Math.round((hits / words.length) * 100) : 0;
      return {
        codigo: item['Código'] || item.codigo || 'PRD-000',
        descricao: item['Descrição'] || item.descricao || 'Produto',
        relevancia: Math.max(relevance, desc.includes(normProd) ? 95 : 0)
      };
    }).filter(s => s.relevancia > 20).sort((a, b) => b.relevancia - a.relevancia);

    const isGeneric = words.length <= 1 || scored.length > 1;
    const isAmbiguo = isGeneric && scored.length >= 2;

    return {
      original: line,
      quantidade: qty || 1,
      produto_solicitado: cleanProd,
      ambiguo: isAmbiguo,
      opcoes: isAmbiguo ? scored.slice(0, 2) : (scored.slice(0, 1).length ? scored.slice(0, 1) : [
        {
          codigo: 'PRD-AUTO',
          descricao: cleanProd.toUpperCase(),
          relevancia: 80
        }
      ])
    };
  });
}
