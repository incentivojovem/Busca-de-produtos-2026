import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { DataRow, OrderControlRow, InterpretedOrderItem } from '../types';
import { requestOrderInterpretation } from '../utils/apiClient';
import {
  Printer,
  Sparkles,
  ClipboardList,
  RotateCcw,
  Users,
  Calendar,
  Layers,
  Check,
  Copy,
  FileText,
  QrCode,
  Tag,
  Search,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface IdentificacaoViewProps {
  products: DataRow[];
  clients: DataRow[];
  onToast: (msg: string) => void;
  showAppLoader: (title: string, text: string) => void;
  hideAppLoader: () => void;
  onOpenPrintClient?: (client: DataRow) => void;
  onReturnToSearch?: () => void;
}

export const IdentificacaoView: React.FC<IdentificacaoViewProps> = ({
  products,
  clients,
  onToast,
  showAppLoader,
  hideAppLoader,
  onOpenPrintClient,
  onReturnToSearch
}) => {
  // Current Date State
  const now = new Date();
  const monthsUpper = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];

  const [dia, setDia] = useState(String(now.getDate()).padStart(2, '0'));
  const [mes, setMes] = useState(monthsUpper[now.getMonth()]);
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [orientacao, setOrientacao] = useState<'retrato' | 'paisagem'>('retrato');

  // 35 rows state
  const initializeRows = (): OrderControlRow[] => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i + 1,
      numero: i + 1,
      cliente: '',
      separador: '',
      friosFlv: false,
      retirarLoja: false,
      observacoes: ''
    }));
  };

  const [rows, setRows] = useState<OrderControlRow[]>(initializeRows);

  // Sub-Modals State
  const [showAiOrderModal, setShowAiOrderModal] = useState(false);
  const [whatsappText, setWhatsappText] = useState('');
  const [interpretedItems, setInterpretedItems] = useState<InterpretedOrderItem[]>([]);
  const [isInterpreting, setIsInterpreting] = useState(false);

  // Client QR Code Label Modal State
  const [showClientLabelModal, setShowClientLabelModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<DataRow | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Row update handlers
  const handleCellChange = (index: number, field: keyof OrderControlRow, value: any) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Quick Action: Preencher com clientes da base
  const handleFillClients = () => {
    if (!clients.length) {
      onToast('Nenhum cliente disponível na base de dados.');
      return;
    }
    setRows(prev => {
      return prev.map((r, i) => {
        const client = clients[i % clients.length];
        return {
          ...r,
          cliente: client['Razão Social'] || client['Nome Fantasia'] || client['Cliente'] || ''
        };
      });
    });
    onToast('Folha preenchida com clientes da base.');
  };

  // Quick Action: Limpar folha
  const handleClearSheet = () => {
    if (window.confirm('Limpar todas as 35 linhas do controle de pedidos?')) {
      setRows(initializeRows());
      onToast('Folha reiniciada em branco.');
    }
  };

  // Quick Action: Definir data de hoje
  const handleSetToday = () => {
    const today = new Date();
    setDia(String(today.getDate()).padStart(2, '0'));
    setMes(monthsUpper[today.getMonth()]);
    setAno(String(today.getFullYear()));
    onToast('Data atualizada para hoje.');
  };

  // ------------------------------------------------------------------------
  // HIGH-RESOLUTION 2D CANVAS PRINT ENGINE (A4 300 DPI: 2480 x 3508 / 3508 x 2480)
  // ------------------------------------------------------------------------
  const handlePrintCanvas = async () => {
    showAppLoader('Gerando Ficha em Alta Definição', 'Desenhando grade milimétrica em Canvas 2D a 300 DPI...');

    try {
      const isRetrato = orientacao === 'retrato';
      const canvas = document.createElement('canvas');
      canvas.width = isRetrato ? 2480 : 3508;
      canvas.height = isRetrato ? 3508 : 2480;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Não foi possível inicializar contexto Canvas 2D.');

      const W = canvas.width;
      const H = canvas.height;

      // Pure White Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Outer margin border
      const margin = 80;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(margin, margin, W - margin * 2, H - margin * 2);

      // Header Box
      const headerH = 220;
      ctx.strokeRect(margin, margin, W - margin * 2, headerH);

      // SF Logo Box
      const logoBoxW = 200;
      ctx.fillStyle = '#000000';
      ctx.fillRect(margin, margin, logoBoxW, headerH);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SF', margin + logoBoxW / 2, margin + headerH / 2);

      // Title
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.font = '900 68px sans-serif';
      ctx.fillText('CONTROLE DE PEDIDOS', margin + logoBoxW + 60, margin + 85);

      ctx.font = '700 32px sans-serif';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('SUPERFÁCIL ATACADO · EXPEDIÇÃO & SEPARAÇÃO', margin + logoBoxW + 60, margin + 145);

      // Date boxes on right
      const dateW = 680;
      const dateStartX = W - margin - dateW;
      ctx.strokeRect(dateStartX, margin, dateW, headerH);

      ctx.fillStyle = '#111827';
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DATA DO CONTROLE', dateStartX + dateW / 2, margin + 50);

      // 3 boxes for DIA / MES / ANO
      const subBoxY = margin + 80;
      const subBoxH = 110;
      const boxW1 = 180;
      const boxW2 = 320;
      const boxW3 = 180;

      ctx.strokeRect(dateStartX + 15, subBoxY, boxW1, subBoxH);
      ctx.strokeRect(dateStartX + 25 + boxW1, subBoxY, boxW2, subBoxH);
      ctx.strokeRect(dateStartX + 35 + boxW1 + boxW2, subBoxY, boxW3, subBoxH);

      ctx.fillStyle = '#000000';
      ctx.font = '900 44px monospace';
      ctx.fillText(dia || '--', dateStartX + 15 + boxW1 / 2, subBoxY + subBoxH / 2 + 5);
      ctx.font = '900 34px sans-serif';
      ctx.fillText(mes || '---', dateStartX + 25 + boxW1 + boxW2 / 2, subBoxY + subBoxH / 2 + 5);
      ctx.font = '900 44px monospace';
      ctx.fillText(ano || '----', dateStartX + 35 + boxW1 + boxW2 + boxW3 / 2, subBoxY + subBoxH / 2 + 5);

      // -------------------------------------------------------------
      // TABLE GRID (EXACTLY 35 ROWS)
      // -------------------------------------------------------------
      const tableTop = margin + headerH + 30;
      const tableBottom = H - margin - 80;
      const tableH = tableBottom - tableTop;
      const tableW = W - margin * 2;

      // Columns proportion
      const colWidths = isRetrato
        ? [120, 840, 420, 240, 240, 460]
        : [150, 1200, 550, 350, 350, 748];

      const colTitles = ['Nº', 'CLIENTE', 'SEPARADOR', 'FRIOS / FLV', 'RETIRAR EM LOJA', 'OBSERVAÇÕES'];

      // Header row of table
      const tableHeadH = 80;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(margin, tableTop, tableW, tableHeadH);
      ctx.strokeRect(margin, tableTop, tableW, tableHeadH);

      let curX = margin;
      ctx.fillStyle = '#000000';
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      colTitles.forEach((title, idx) => {
        const w = colWidths[idx];
        ctx.strokeRect(curX, tableTop, w, tableHeadH);
        ctx.fillText(title, curX + w / 2, tableTop + tableHeadH / 2);
        curX += w;
      });

      // Rows
      const rowCount = 35;
      const rowH = (tableH - tableHeadH) / rowCount;

      for (let i = 0; i < rowCount; i++) {
        const rowData = rows[i];
        const y = tableTop + tableHeadH + i * rowH;

        let colX = margin;

        // Nº
        ctx.strokeRect(colX, y, colWidths[0], rowH);
        ctx.font = '900 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#374151';
        ctx.fillText(String(i + 1), colX + colWidths[0] / 2, y + rowH / 2);
        colX += colWidths[0];

        // CLIENTE
        ctx.strokeRect(colX, y, colWidths[1], rowH);
        if (rowData?.cliente) {
          ctx.font = '800 26px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#000000';
          const maxTextW = colWidths[1] - 40;
          let txt = rowData.cliente.toUpperCase();
          if (ctx.measureText(txt).width > maxTextW) {
            while (ctx.measureText(txt + '...').width > maxTextW && txt.length > 5) {
              txt = txt.slice(0, -1);
            }
            txt += '...';
          }
          ctx.fillText(txt, colX + 20, y + rowH / 2);
        }
        colX += colWidths[1];

        // SEPARADOR
        ctx.strokeRect(colX, y, colWidths[2], rowH);
        if (rowData?.separador) {
          ctx.font = '700 24px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#111827';
          ctx.fillText(rowData.separador.toUpperCase(), colX + 20, y + rowH / 2);
        }
        colX += colWidths[2];

        // FRIOS / FLV (Checkbox Box)
        ctx.strokeRect(colX, y, colWidths[3], rowH);
        const checkSize = 40;
        const checkX = colX + (colWidths[3] - checkSize) / 2;
        const checkY = y + (rowH - checkSize) / 2;
        ctx.strokeRect(checkX, checkY, checkSize, checkSize);
        if (rowData?.friosFlv) {
          ctx.font = '900 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000000';
          ctx.fillText('X', checkX + checkSize / 2, checkY + checkSize / 2);
        }
        colX += colWidths[3];

        // RETIRAR EM LOJA (Checkbox Box)
        ctx.strokeRect(colX, y, colWidths[4], rowH);
        const checkX2 = colX + (colWidths[4] - checkSize) / 2;
        const checkY2 = y + (rowH - checkSize) / 2;
        ctx.strokeRect(checkX2, checkY2, checkSize, checkSize);
        if (rowData?.retirarLoja) {
          ctx.font = '900 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000000';
          ctx.fillText('X', checkX2 + checkSize / 2, checkY2 + checkSize / 2);
        }
        colX += colWidths[4];

        // OBSERVAÇÕES
        ctx.strokeRect(colX, y, colWidths[5], rowH);
        if (rowData?.observacoes) {
          ctx.font = '600 22px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#4b5563';
          ctx.fillText(rowData.observacoes, colX + 15, y + rowH / 2);
        }
      }

      // Footer line
      ctx.font = '700 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('SUPERFÁCIL ATACADO · SISTEMA DE GESTÃO E EXPEDIÇÃO INTEGRADO', margin + 10, H - margin / 2);

      ctx.textAlign = 'right';
      ctx.fillText(`EMISSÃO EM ALTA RESOLUÇÃO · 300 DPI · ${dia}/${mes}/${ano}`, W - margin - 10, H - margin / 2);

      // Convert to clean PNG and open full-page printable view
      const pngUrl = canvas.toDataURL('image/png');

      const printWindow = window.open('', '_blank', 'width=1100,height=850');
      if (!printWindow) {
        throw new Error('Janela popup bloqueada pelo navegador. Permita popups para visualizar a impressão.');
      }

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Controle de Pedidos - ${dia}_${mes}_${ano}</title>
  <style>
    @page { size: ${isRetrato ? 'A4 portrait' : 'A4 landscape'}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw;
      height: 100vh;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
  </style>
</head>
<body>
  <img src="${pngUrl}" alt="Controle de Pedidos">
  <script>
    window.addEventListener('afterprint', function() {
      setTimeout(function() { try { window.close(); } catch(e){} }, 150);
    });
  <\/script>
</body>
</html>`);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 350);

      onToast('Ficha de controle de pedidos renderizada para impressão.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao preparar a folha para impressão.');
    } finally {
      hideAppLoader();
    }
  };

  // ------------------------------------------------------------------------
  // AI ORDER INTERPRETATION (WHATSAPP TO ERP)
  // ------------------------------------------------------------------------
  const handleInterpretOrder = async () => {
    if (!whatsappText.trim()) {
      alert('Cole o texto do pedido enviado pelo cliente (ex: copiado do WhatsApp).');
      return;
    }

    setIsInterpreting(true);
    showAppLoader('Interpretando Pedido com IA', 'Mapeando termos, extraindo quantidades e verificando ambiguidade no estoque...');

    try {
      const items = await requestOrderInterpretation(whatsappText, products);

      // Pre-select first option for each item
      const enriched = items.map(item => ({
        ...item,
        selectedCodigo: item.opcoes[0]?.codigo || '',
        selectedDescricao: item.opcoes[0]?.descricao || item.produto_solicitado
      }));

      setInterpretedItems(enriched);
      onToast(`${enriched.length} produto(s) identificado(s) na mensagem.`);
    } catch (e: any) {
      console.error(e);
      alert('Falha ao interpretar o pedido: ' + (e.message || e));
    } finally {
      setIsInterpreting(false);
      hideAppLoader();
    }
  };

  // Select radio option for ambiguous item
  const handleSelectOption = (itemIndex: number, codigo: string, descricao: string) => {
    setInterpretedItems(prev => {
      const copy = [...prev];
      copy[itemIndex] = {
        ...copy[itemIndex],
        selectedCodigo: codigo,
        selectedDescricao: descricao
      };
      return copy;
    });
  };

  // Copy codes list for ERP
  const handleCopyProductCodes = () => {
    const codes = interpretedItems.map(it => it.selectedCodigo || it.opcoes[0]?.codigo || '').filter(Boolean);
    if (!codes.length) {
      onToast('Nenhum código disponível para copiar.');
      return;
    }
    const cleanList = codes.join('\n');
    navigator.clipboard.writeText(cleanList);
    onToast(`${codes.length} código(s) copiado(s) para o ERP.`);
  };

  // Copy structured order text
  const handleCopyFormattedOrder = () => {
    const textLines = interpretedItems.map(it => {
      const qty = it.quantidade || 1;
      const desc = it.selectedDescricao || it.opcoes[0]?.descricao || it.produto_solicitado;
      const code = it.selectedCodigo || it.opcoes[0]?.codigo || '';
      return `${qty}x [${code}] ${desc}`;
    });

    const full = `PEDIDO DE SEPARAÇÃO - SUPERFÁCIL ATACADO\nDATA: ${new Date().toLocaleDateString('pt-BR')}\n----------------------------------------\n${textLines.join('\n')}\n----------------------------------------\nTOTAL DE ITENS: ${interpretedItems.length}`;

    navigator.clipboard.writeText(full);
    onToast('Pedido formatado copiado com sucesso.');
  };

  // ------------------------------------------------------------------------
  // CLIENT PALLET LABEL IN 2D CANVAS WITH QR CODE
  // ------------------------------------------------------------------------
  const handlePrintPalletLabel = async (client: DataRow) => {
    showAppLoader('Gerando Etiqueta de Palete', 'Renderizando etiqueta em Canvas 2D com QR Code...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto Canvas.');

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1600, 1000);

      // Thick border
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(10, 10, 1580, 980);

      // Header block
      ctx.fillStyle = '#000000';
      ctx.fillRect(10, 10, 1580, 160);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 56px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUPERFÁCIL ATACADO · EXPEDIÇÃO', 50, 90);

      ctx.textAlign = 'right';
      ctx.font = '900 36px monospace';
      ctx.fillText(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 1540, 90);

      // Client Code Box
      const code = client['Código'] || 'CLI-000';
      ctx.strokeRect(50, 200, 480, 140);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(52, 202, 476, 136);

      ctx.fillStyle = '#4b5563';
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CÓDIGO DO CLIENTE', 290, 240);

      ctx.fillStyle = '#000000';
      ctx.font = '900 52px monospace';
      ctx.fillText(code, 290, 305);

      // QR Code Generation
      const qrData = `https://incentivojovem.github.io/Buscadeprodutos/?cliente=${encodeURIComponent(code)}`;
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

      await new Promise(res => {
        qrImg.onload = res;
        qrImg.onerror = res;
      });

      const qrSize = 340;
      const qrX = 1200;
      const qrY = 200;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);
      if (qrImg.naturalWidth > 0) {
        ctx.drawImage(qrImg, qrX + 20, qrY + 20, qrSize - 40, qrSize - 40);
      }

      ctx.fillStyle = '#000000';
      ctx.font = '900 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CONFERÊNCIA RÁPIDA', qrX + qrSize / 2, qrY + qrSize + 35);

      // Client Details
      const razao = String(client['Razão Social'] || client['Cliente'] || 'NÃO INFORMADO').toUpperCase();
      const cnpj = String(client['CNPJ'] || 'NÃO INFORMADO');
      const endereco = String(client['Endereço'] || 'NÃO INFORMADO').toUpperCase();
      const bairro = String(client['Bairro'] || 'NÃO INFORMADO').toUpperCase();
      const vendedor = String(client['Vendedor'] || 'NÃO INFORMADO').toUpperCase();

      ctx.textAlign = 'left';

      ctx.fillStyle = '#6b7280';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('RAZÃO SOCIAL / CLIENTE:', 50, 410);
      ctx.fillStyle = '#000000';
      ctx.font = '900 48px sans-serif';
      ctx.fillText(razao.length > 32 ? razao.slice(0, 32) + '...' : razao, 50, 465);

      ctx.fillStyle = '#6b7280';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('CNPJ / DOCUMENTO:', 50, 540);
      ctx.fillStyle = '#000000';
      ctx.font = '900 36px monospace';
      ctx.fillText(cnpj, 50, 585);

      ctx.fillStyle = '#6b7280';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('ENDEREÇO DE ENTREGA / BAIRRO:', 50, 660);
      ctx.fillStyle = '#000000';
      ctx.font = '900 36px sans-serif';
      ctx.fillText(`${endereco} · ${bairro}`, 50, 710);

      ctx.fillStyle = '#6b7280';
      ctx.font = '900 24px sans-serif';
      ctx.fillText('VENDEDOR RESPONSÁVEL:', 50, 785);
      ctx.fillStyle = '#000000';
      ctx.font = '900 36px sans-serif';
      ctx.fillText(vendedor, 50, 830);

      // Bottom Bar
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(10, 880, 1580, 110);
      ctx.strokeRect(10, 880, 1580, 110);

      ctx.fillStyle = '#111827';
      ctx.font = '900 30px sans-serif';
      ctx.fillText('✓ ETIQUETA HOMOLOGADA PARA PALETE & CAIXA FECHADA', 50, 940);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#059669';
      ctx.fillText('CARGA VERIFICADA', 1540, 940);

      const png = canvas.toDataURL('image/png');
      const w = window.open('', '_blank', 'width=1000,height=750');
      if (!w) throw new Error('Popup bloqueado pelo navegador.');

      w.document.open();
      w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiqueta de Palete - ${code}</title>
  <style>
    @page { size: landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100vw; height: 100vh; background: #fff; display: flex; align-items: center; justify-content: center; }
    img { width: 15.2cm; max-width: 95vw; height: auto; object-fit: contain; }
  </style>
</head>
<body>
  <img src="${png}" alt="Etiqueta Palete">
  <script>
    window.addEventListener('afterprint', function() {
      setTimeout(function() { try { window.close(); } catch(e){} }, 150);
    });
  <\/script>
</body>
</html>`);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 350);

      setShowClientLabelModal(false);
      onToast('Etiqueta enviada para impressão! Retornando...');
      if (onReturnToSearch) {
        setTimeout(() => onReturnToSearch(), 400);
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar etiqueta de palete.');
    } finally {
      hideAppLoader();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-black tracking-wide uppercase mb-2">
              <ClipboardList className="w-3.5 h-3.5" />
              Módulo de Identificação & Controle
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Ficha de Controle de Pedidos & Separação
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gere folhas de controle com 35 linhas, interprete mensagens do WhatsApp por IA e imprima etiquetas com QR Code.
            </p>
          </div>

          {/* Quick Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiOrderModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black tracking-wide shadow-sm inline-flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Interpretar Pedido (IA)
            </button>

            <button
              type="button"
              onClick={() => setShowClientLabelModal(true)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <QrCode className="w-3.5 h-3.5" />
              Etiqueta com QR Code
            </button>
          </div>
        </div>

        {/* Date Selector & Layout Actions */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-500 uppercase text-[10px]">Dia:</span>
              <input
                type="text"
                maxLength={2}
                value={dia}
                onChange={e => setDia(e.target.value)}
                className="w-8 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-black"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-500 uppercase text-[10px]">Mês:</span>
              <input
                type="text"
                value={mes}
                onChange={e => setMes(e.target.value.toUpperCase())}
                className="w-28 text-center uppercase bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-black text-[11px]"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-500 uppercase text-[10px]">Ano:</span>
              <input
                type="text"
                maxLength={4}
                value={ano}
                onChange={e => setAno(e.target.value)}
                className="w-14 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-mono font-black"
              />
            </div>

            <button
              type="button"
              onClick={handleSetToday}
              className="p-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Definir Data de Hoje"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOrientacao(orientacao === 'retrato' ? 'paisagem' : 'retrato')}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Orientação: <span className="uppercase font-black text-blue-600 dark:text-blue-400">{orientacao}</span>
            </button>

            <button
              type="button"
              onClick={handleFillClients}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Preencher com Clientes da Base
            </button>

            <button
              type="button"
              onClick={handleClearSheet}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar / Folha em Branco
            </button>

            <button
              type="button"
              onClick={handlePrintCanvas}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-wide shadow-md shadow-emerald-500/20 inline-flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir em Canvas 2D (A4 300 DPI)
            </button>
          </div>
        </div>
      </div>

      {/* 35-Row Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Grade de Separação · 35 Linhas Numeradas
          </div>
          <div className="text-xs text-slate-400">
            Clique nas células para editar ou preencher
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
              <tr>
                <th className="p-3 w-14 text-center border-b border-r border-slate-200 dark:border-slate-700">Nº</th>
                <th className="p-3 border-b border-r border-slate-200 dark:border-slate-700">Cliente</th>
                <th className="p-3 w-48 border-b border-r border-slate-200 dark:border-slate-700">Separador</th>
                <th className="p-3 w-28 text-center border-b border-r border-slate-200 dark:border-slate-700">Frios / FLV</th>
                <th className="p-3 w-32 text-center border-b border-r border-slate-200 dark:border-slate-700">Retirar em Loja</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="p-2 text-center font-mono font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800">
                    {row.numero}
                  </td>
                  <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      value={row.cliente}
                      onChange={e => handleCellChange(idx, 'cliente', e.target.value)}
                      placeholder="Nome ou Razão Social do cliente..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-1 border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      value={row.separador}
                      onChange={e => handleCellChange(idx, 'separador', e.target.value)}
                      placeholder="Nome do separador"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 font-semibold outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                    />
                  </td>
                  <td className="p-2 text-center border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={row.friosFlv}
                      onChange={e => handleCellChange(idx, 'friosFlv', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-2 text-center border-r border-slate-200 dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={row.retirarLoja}
                      onChange={e => handleCellChange(idx, 'retirarLoja', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.observacoes}
                      onChange={e => handleCellChange(idx, 'observacoes', e.target.value)}
                      placeholder="Obs: rota, horário, notas..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-600 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: INTERPRETAÇÃO DE PEDIDOS POR IA (WHATSAPP TO ERP)           */}
      {/* ------------------------------------------------------------------ */}
      {showAiOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Interpretação Inteligente de Pedidos (WhatsApp / Texto)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    A IA extrai quantidades, limpa saudações e mapeia para o catálogo de produtos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiOrderModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Cole a mensagem recebida do cliente
                </label>
                <textarea
                  rows={4}
                  value={whatsappText}
                  onChange={e => setWhatsappText(e.target.value)}
                  placeholder="Exemplo:&#10;Bom dia amigo, manda pra mim hoje por favor:&#10;10 cx de cerveja heineken&#10;5 fardo de coca cola 2l&#10;12 arroz camil&#10;3 sabao em po omo"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isInterpreting || !whatsappText.trim()}
                  onClick={handleInterpretOrder}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs tracking-wide shadow-md shadow-purple-500/20 inline-flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isInterpreting ? 'Interpretando...' : 'Identificar Produtos com IA'}
                </button>
              </div>

              {/* Interpreted Results List */}
              {interpretedItems.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Produtos Mapeados ({interpretedItems.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyProductCodes}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar Códigos
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyFormattedOrder}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-white inline-flex items-center gap-1 transition"
                      >
                        <FileText className="w-3 h-3" />
                        Copiar Pedido Formatado
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {interpretedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border ${
                          item.ambiguo
                            ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono font-black text-xs mr-2">
                              {item.quantidade ? `${item.quantidade}x` : '1x'}
                            </span>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.produto_solicitado}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5 italic">
                              "{item.original}"
                            </div>
                          </div>

                          {item.ambiguo && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                              Ambíguo (Selecione)
                            </span>
                          )}
                        </div>

                        {/* Options / Radio Selection */}
                        <div className="mt-2.5 space-y-1.5 pl-2 border-l-2 border-purple-300 dark:border-purple-700">
                          {item.opcoes.map((op, oIdx) => {
                            const isSelected = item.selectedCodigo === op.codigo;
                            return (
                              <label
                                key={oIdx}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                                  isSelected
                                    ? 'bg-purple-100/70 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 font-bold'
                                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`item-opt-${idx}`}
                                    checked={isSelected}
                                    onChange={() => handleSelectOption(idx, op.codigo, op.descricao)}
                                    className="text-purple-600"
                                  />
                                  <span className="font-mono font-black text-purple-700 dark:text-purple-300">
                                    [{op.codigo}]
                                  </span>
                                  <span>{op.descricao}</span>
                                </div>
                                <span className="text-[10px] opacity-75 font-semibold">
                                  {op.relevancia}% rel.
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAiOrderModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ETIQUETA DE CLIENTE COM QR CODE & IMPRESSÃO PALETE          */}
      {/* ------------------------------------------------------------------ */}
      {showClientLabelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Ficha de Identificação com QR Code & Palete
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione um cliente para gerar a etiqueta homologada com QR Code escaneável.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClientLabelModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Buscar cliente na base
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Digite código, razão social ou CNPJ..."
                    value={clientSearchQuery}
                    onChange={e => setClientSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Clients quick picker */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/40">
                {clients
                  .filter(c => {
                    const q = clientSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    const r = String(c['Razão Social'] || c['Nome Fantasia'] || '').toLowerCase();
                    const cod = String(c['Código'] || '').toLowerCase();
                    const doc = String(c['CNPJ'] || '').replace(/\D/g, '');
                    return r.includes(q) || cod.includes(q) || doc.includes(q.replace(/\D/g, ''));
                  })
                  .slice(0, 10)
                  .map(c => {
                    const isSelected = selectedClient?._docId === c._docId;
                    return (
                      <div
                        key={c._docId || Math.random()}
                        onClick={() => setSelectedClient(c)}
                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate">{c['Razão Social'] || c['Nome Fantasia']}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            {c['Código'] ? `Código: ${c['Código']} · ` : ''}CNPJ: {c['CNPJ'] || '---'}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </div>
                    );
                  })}
              </div>

              {/* Selected Client Card Preview with QR Code */}
              {selectedClient && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-center gap-5">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <QRCode
                      size={110}
                      value={`https://incentivojovem.github.io/Buscadeprodutos/?cliente=${encodeURIComponent(
                        selectedClient['Código'] || ''
                      )}`}
                    />
                    <div className="text-[9px] font-black text-center mt-1 font-mono text-slate-600">
                      LEITURA RÁPIDA
                    </div>
                  </div>

                  <div className="space-y-1 text-xs min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 font-mono">
                      CÓDIGO: {selectedClient['Código'] || '---'}
                    </div>
                    <div className="text-sm font-black uppercase text-slate-900 dark:text-white truncate">
                      {selectedClient['Razão Social'] || selectedClient['Nome Fantasia']}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      <b>CNPJ:</b> {selectedClient['CNPJ'] || 'Não informado'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      <b>Endereço:</b> {selectedClient['Endereço'] || 'Não informado'} · {selectedClient['Bairro'] || ''}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                      <b>Vendedor:</b> {selectedClient['Vendedor'] || 'Não informado'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Gera etiqueta de palete/caixa desenhada em Canvas 2D
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClientLabelModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Fechar
                </button>
                {onOpenPrintClient && (
                  <button
                    type="button"
                    disabled={!selectedClient}
                    onClick={() => {
                      if (selectedClient) {
                        setShowClientLabelModal(false);
                        onOpenPrintClient(selectedClient);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-xs font-black tracking-wide shadow-md inline-flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Ficha Completa
                  </button>
                )}
                <button
                  type="button"
                  disabled={!selectedClient}
                  onClick={() => selectedClient && handlePrintPalletLabel(selectedClient)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black tracking-wide shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Etiqueta de Palete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
