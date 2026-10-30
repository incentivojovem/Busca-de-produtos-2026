import React, { useState, useEffect } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { OsintDossier, DataRow } from '../types';
import { formatCnpj, formatCep, fetchCnpjData, fetchCepData, requestOsintInvestigation } from '../utils/apiClient';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  UserCheck,
  Search,
  Copy,
  Printer,
  History,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

interface OsintToolProps {
  clients: DataRow[];
  onToast: (msg: string) => void;
  showAppLoader: (title: string, text: string) => void;
  hideAppLoader: () => void;
}

export const OsintTool: React.FC<OsintToolProps> = ({
  clients,
  onToast,
  showAppLoader,
  hideAppLoader
}) => {
  // Form fields
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  // Validation states
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjPublicData, setCnpjPublicData] = useState<any>(null);

  // OSINT Result & History
  const [dossier, setDossier] = useState<OsintDossier | null>(null);
  const [history, setHistory] = useState<OsintDossier[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [investigating, setInvestigating] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('osint_history_v1');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erro ao carregar histórico OSINT:', e);
    }
  }, []);

  const saveToHistory = (newDossier: OsintDossier) => {
    try {
      const updated = [newDossier, ...history.filter(h => h.nomeConsultado !== newDossier.nomeConsultado)].slice(0, 15);
      setHistory(updated);
      localStorage.setItem('osint_history_v1', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar no histórico:', e);
    }
  };

  // Telefone format & validation with libphonenumber-js
  const handleTelefoneChange = (v: string) => {
    setTelefone(v);
    const parsed = parsePhoneNumberFromString(v, 'BR');
    if (parsed) {
      setPhoneValid(parsed.isValid());
      if (parsed.isValid()) {
        setTelefone(parsed.formatNational());
      }
    } else {
      setPhoneValid(v.replace(/\D/g, '').length >= 10 ? null : false);
    }
  };

  // CNPJ format & auto lookup
  const handleCnpjChange = async (v: string) => {
    const formatted = formatCnpj(v);
    setCnpj(formatted);
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 14) {
      setLoadingCnpj(true);
      try {
        const res = await fetchCnpjData(clean);
        if (res && res.data) {
          const d = res.data;
          setCnpjPublicData(d);
          if (d.nome || d.razao_social) {
            onToast(`CNPJ identificado: ${d.nome || d.razao_social}`);
          }
          if (d.cep && !cep) {
            handleCepChange(d.cep);
          }
          if (d.telefone && !telefone) {
            handleTelefoneChange(d.telefone);
          }
          if (d.email && !email) {
            setEmail(d.email);
          }
        }
      } catch (err) {
        console.warn('Aviso CNPJ público:', err);
      } finally {
        setLoadingCnpj(false);
      }
    }
  };

  // CEP format & auto lookup
  const handleCepChange = async (v: string) => {
    const formatted = formatCep(v);
    setCep(formatted);
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetchCepData(clean);
        if (res && res.data) {
          const d = res.data;
          setLogradouro(d.logradouro || d.street || '');
          setBairro(d.bairro || d.neighborhood || '');
          setCidade(d.localidade || d.city || '');
          setUf(d.uf || d.state || '');
          onToast(`Endereço carregado: ${d.localidade || d.city}/${d.uf || d.state}`);
        }
      } catch (err) {
        console.warn('Aviso CEP:', err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Cross reference with local clients
  const findLocalClientMatches = () => {
    const cleanName = nome.trim().toLowerCase();
    const cleanC = cnpj.replace(/\D/g, '');

    return clients.filter(c => {
      const cName = String(c['Razão Social'] || c['Nome Fantasia'] || '').toLowerCase();
      const cCnpj = String(c['CNPJ'] || '').replace(/\D/g, '');
      const cTel = String(c['Telefone'] || '').replace(/\D/g, '');
      const cEmail = String(c['Email'] || c['E-mail'] || '').toLowerCase();

      if (cleanC && cCnpj.includes(cleanC)) return true;
      if (cleanName && cName.includes(cleanName)) return true;
      if (email && cEmail.includes(email.toLowerCase())) return true;
      if (telefone && cTel && telefone.replace(/\D/g, '').includes(cTel)) return true;
      return false;
    });
  };

  // Execute full investigation
  const handleInvestigate = async () => {
    if (!nome.trim()) {
      alert('Informe o Nome do sócio, administrador ou representante a ser investigado.');
      return;
    }

    setInvestigating(true);
    showAppLoader('Investigação OSINT em Andamento', 'Consultando IA, cruzando bases federais e analisando riscos societários...');

    try {
      const localMatches = findLocalClientMatches();
      const result = await requestOsintInvestigation({
        nome,
        cnpj,
        email,
        telefone,
        localMatches
      });

      // Enrich with public CNPJ data if available
      if (cnpjPublicData && result.empresasVinculadas && result.empresasVinculadas.length > 0) {
        const main = result.empresasVinculadas[0];
        if (cnpjPublicData.razao_social || cnpjPublicData.nome) {
          main.razaoSocial = cnpjPublicData.razao_social || cnpjPublicData.nome;
        }
        if (cnpjPublicData.cnae_fiscal_descricao || cnpjPublicData.atividade_principal?.[0]?.text) {
          main.cnae = cnpjPublicData.cnae_fiscal_descricao || cnpjPublicData.atividade_principal[0].text;
        }
      }

      setDossier(result);
      saveToHistory(result);
      onToast('Dossiê OSINT gerado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro na investigação OSINT: ' + (err.message || err));
    } finally {
      setInvestigating(false);
      hideAppLoader();
    }
  };

  // Copy full dossier to clipboard
  const handleCopyDossier = () => {
    if (!dossier) return;
    const text = `========================================================
DOSSIÊ DE INTELIGÊNCIA CADASTRAL & DUE DILIGENCE (OSINT)
SUPERFÁCIL ATACADO - COMPLIANCE & RISCO
========================================================
TITULAR CONSULTADO: ${dossier.nomeConsultado}
STATUS: ${dossier.status.toUpperCase()}
QUALIFICAÇÃO: ${dossier.qualificacaoPrincipal}
EMISSÃO: ${dossier.dataConsulta || new Date().toLocaleString('pt-BR')}

RESUMO EXECUTIVO:
${dossier.resumoExecutivo}

EMPRESAS VINCULADAS:
${dossier.empresasVinculadas.map(e => `- ${e.razaoSocial} | CNPJ: ${e.cnpj} | Cargo: ${e.cargo} | Situação: ${e.situacaoFazenda} | CNAE: ${e.cnae}`).join('\n')}

TELEFONES CONSOLIDADOS:
${dossier.telefonesConsolidados.join(', ') || 'Nenhum'}

E-MAILS CONSOLIDADOS:
${dossier.emailsConsolidados.join(', ') || 'Nenhum'}

ALERTAS DE CONFORMIDADE:
${dossier.alertasConformidade.map(a => `• ${a}`).join('\n')}

CONEXÕES SOCIETÁRIAS:
${dossier.conexoesSocietarias.map(c => `• ${c}`).join('\n')}
========================================================`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('Dossiê completo copiado para a área de transferência.');
    } else {
      onToast('Área de transferência indisponível.');
    }
  };

  // Print Dossier (A4 formatted)
  const handlePrintDossier = () => {
    if (!dossier) return;
    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) {
      alert('Permita popups no navegador para imprimir o dossiê.');
      return;
    }

    const statusBadgeColors = {
      homologado: '#059669',
      validado: '#2563eb',
      multiplos_vinculos: '#d97706',
      alerta_cadastral: '#dc2626'
    };

    const statusColor = statusBadgeColors[dossier.status] || '#2563eb';

    w.document.open();
    w.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Dossiê OSINT - ${dossier.nomeConsultado}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; font-family: Inter, Arial, sans-serif; color: #1e293b; }
    body { background: #fff; line-height: 1.45; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: #0f172a; }
    .meta { font-size: 10px; color: #64748b; font-weight: 700; text-align: right; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 900; color: #fff; background: ${statusColor}; text-transform: uppercase; margin-top: 5px; }
    .section-title { font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-left: 4px solid #2563eb; padding-left: 8px; margin: 16px 0 8px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 11px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    .table th { background: #f1f5f9; font-weight: 800; color: #334155; }
    .alert-item { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 6px 10px; margin-bottom: 4px; font-size: 10.5px; }
    .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Dossiê de Inteligência Societária & KYC</div>
      <div style="font-size: 12px; font-weight: 800; color: #2563eb; margin-top: 2px;">SUPERFÁCIL ATACADO · AUDITORIA DE RISCO</div>
      <div class="status-badge">${dossier.status.replace('_', ' ')}</div>
    </div>
    <div class="meta">
      CONSULTA EMITIDA EM: ${dossier.dataConsulta || new Date().toLocaleString('pt-BR')}<br>
      ID AUDITORIA: OSINT-${Math.random().toString(36).slice(2, 9).toUpperCase()}
    </div>
  </div>

  <div class="section-title">Resumo Executivo do Titular</div>
  <div class="box">
    <b>Nome Consultado:</b> ${dossier.nomeConsultado}<br>
    <b>Qualificação Principal:</b> ${dossier.qualificacaoPrincipal}<br>
    <div style="margin-top: 6px; line-height: 1.5;">${dossier.resumoExecutivo}</div>
  </div>

  <div class="section-title">Quadro Societário e Empresas Vinculadas</div>
  <table class="table">
    <thead>
      <tr>
        <th>CNPJ</th>
        <th>Razão Social</th>
        <th>Cargo</th>
        <th>Situação RF</th>
        <th>UF</th>
        <th>CNAE Principal</th>
      </tr>
    </thead>
    <tbody>
      ${dossier.empresasVinculadas.map(e => `
        <tr>
          <td><b>${e.cnpj}</b></td>
          <td>${e.razaoSocial}</td>
          <td>${e.cargo}</td>
          <td><span style="color: ${e.situacaoFazenda === 'Ativa' ? '#059669' : '#dc2626'}; font-weight: 800;">${e.situacaoFazenda}</span></td>
          <td>${e.uf}</td>
          <td>${e.cnae}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Alertas de Conformidade e Riscos (KYC/KYB)</div>
  <div>
    ${dossier.alertasConformidade.map(a => `<div class="alert-item">⚠️ ${a}</div>`).join('')}
  </div>

  <div class="section-title">Contatos e Conexões Validadas</div>
  <div class="box">
    <b>Telefones Consolidados:</b> ${dossier.telefonesConsolidados.join(', ') || 'Nenhum contato telefônico direto'}<br>
    <b>E-mails Validados:</b> ${dossier.emailsConsolidados.join(', ') || 'Nenhum e-mail público mapeado'}<br>
    <div style="margin-top: 6px;"><b>Rede de Relacionamento Societário:</b></div>
    <ul style="margin: 4px 0 0 16px; padding: 0;">
      ${dossier.conexoesSocietarias.map(c => `<li>${c}</li>`).join('')}
    </ul>
  </div>

  <div class="footer">
    <span>DOCUMENTO CONFIDENCIAL - USO INTERNO EXCLUSIVO DE CRÉDITO E CADASTRO</span>
    <span>✓ DADOS CRUZADOS COM IA & FONTES OFICIAIS</span>
  </div>
</body>
</html>`);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  };

  const statusConfig = {
    validado: {
      label: 'Validado',
      bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
      icon: <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    },
    homologado: {
      label: 'Homologado',
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
    },
    multiplos_vinculos: {
      label: 'Múltiplos Vínculos',
      bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
    },
    alerta_cadastral: {
      label: 'Alerta Cadastral',
      bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
      icon: <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-black tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              OSINT & Due Diligence Corporativa
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Inteligência Cadastral de Sócios e Empresas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Auditoria de antecedentes, rede societária (QSA), conformidade fiscal e validação de contatos em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <History className="w-4 h-4" />
              Histórico ({history.length})
            </button>
          </div>
        </div>

        {/* Saved History Drawer */}
        {showHistory && history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Consultas Salvas no Histórico Local
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setDossier(h);
                    setNome(h.nomeConsultado);
                    setShowHistory(false);
                    onToast(`Dossiê de ${h.nomeConsultado} carregado.`);
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-blue-500 hover:shadow-sm cursor-pointer transition flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-black truncate">{h.nomeConsultado}</div>
                    <div className="text-[10px] text-slate-500 truncate">{h.qualificacaoPrincipal}</div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Form Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
          Parâmetros de Investigação Unificada
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Nome */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              Nome Completo do Sócio / Administrador / Titular *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: Carlos Alberto da Silva"
                className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            </div>
          </div>

          {/* CNPJ */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>CNPJ da Empresa Vinculada</span>
              {loadingCnpj && <span className="text-[10px] text-blue-500 animate-pulse font-bold">Buscando...</span>}
            </label>
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              value={cnpj}
              onChange={e => handleCnpjChange(e.target.value)}
            />
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
              E-mail para Validação de Domínio
            </label>
            <input
              type="email"
              placeholder="socio@empresa.com.br"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Telefone / WhatsApp</span>
              {phoneValid === true && <span className="text-[10px] text-emerald-600 font-bold">✓ Válido (BR)</span>}
              {phoneValid === false && <span className="text-[10px] text-rose-500 font-bold">Formato Inválido</span>}
            </label>
            <input
              type="text"
              placeholder="(11) 98765-4321"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              value={telefone}
              onChange={e => handleTelefoneChange(e.target.value)}
            />
          </div>

          {/* CEP */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>CEP Residencial / Fiscal</span>
              {loadingCep && <span className="text-[10px] text-blue-500 animate-pulse font-bold">Consultando...</span>}
            </label>
            <input
              type="text"
              placeholder="00000-000"
              className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              value={cep}
              onChange={e => handleCepChange(e.target.value)}
            />
          </div>
        </div>

        {/* Address preview if CEP resolved */}
        {(logradouro || cidade) && (
          <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-black text-slate-500 uppercase flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              Endereço Mapeado:
            </span>
            <span className="font-semibold">{logradouro || 'Logradouro'} · {bairro || 'Bairro'} · {cidade}/{uf}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            A consulta em paralelo verifica IA Generativa, Receita Federal e cruza com {clients.length} clientes da base local.
          </div>

          <button
            type="button"
            disabled={investigating || !nome.trim()}
            onClick={handleInvestigate}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm tracking-wide shadow-md shadow-blue-500/20 inline-flex items-center justify-center gap-2 transition"
          >
            <Search className="w-4 h-4" />
            {investigating ? 'Investigando com IA...' : 'Disparar Investigação OSINT'}
          </button>
        </div>
      </div>

      {/* Dossier Display */}
      {dossier && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          {/* Header of Dossier */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    statusConfig[dossier.status]?.bg || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {statusConfig[dossier.status]?.icon}
                  {statusConfig[dossier.status]?.label || dossier.status}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {dossier.dataConsulta || 'Consulta Recente'}
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">
                {dossier.nomeConsultado}
              </h3>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                {dossier.qualificacaoPrincipal}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyDossier}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Dossiê
              </button>
              <button
                type="button"
                onClick={handlePrintDossier}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir A4
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/60">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Síntese Executiva de Inteligência
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
              {dossier.resumoExecutivo}
            </p>
          </div>

          {/* Companies / Corporate Network */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              Quadro Societário e Empresas Vinculadas ({dossier.empresasVinculadas.length})
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">CNPJ</th>
                    <th className="p-3.5">Razão Social</th>
                    <th className="p-3.5">Cargo / Qualificação</th>
                    <th className="p-3.5">Situação</th>
                    <th className="p-3.5">UF</th>
                    <th className="p-3.5">CNAE Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {dossier.empresasVinculadas.map((emp, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">{emp.cnpj}</td>
                      <td className="p-3.5 font-bold">{emp.razaoSocial}</td>
                      <td className="p-3.5">{emp.cargo}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                            emp.situacaoFazenda === 'Ativa'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {emp.situacaoFazenda}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold">{emp.uf}</td>
                      <td className="p-3.5 text-slate-500 max-w-xs truncate" title={emp.cnae}>
                        {emp.cnae}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Alerts & Network */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compliance Alerts */}
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Alertas de Conformidade (KYC/KYB)
              </div>
              <div className="space-y-2">
                {dossier.alertasConformidade.map((alerta, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-start gap-2.5"
                  >
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{alerta}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Corporate Connections & Contacts */}
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                Contatos & Vínculos Societários
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 text-xs">
                <div>
                  <span className="font-black text-slate-400 uppercase text-[10px] block mb-1">
                    Telefones Consolidados
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dossier.telefonesConsolidados.length > 0 ? (
                      dossier.telefonesConsolidados.map((t, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-mono font-bold">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Nenhum telefone público consolidado</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-black text-slate-400 uppercase text-[10px] block mb-1">
                    E-mails Consolidados
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dossier.emailsConsolidados.length > 0 ? (
                      dossier.emailsConsolidados.map((em, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {em}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Nenhum e-mail público mapeado</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-black text-slate-400 uppercase text-[10px] block mb-1">
                    Conexões Societárias Identificadas
                  </span>
                  <ul className="list-disc pl-4 space-y-1 font-medium text-slate-600 dark:text-slate-300">
                    {dossier.conexoesSocietarias.map((cx, i) => (
                      <li key={i}>{cx}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
