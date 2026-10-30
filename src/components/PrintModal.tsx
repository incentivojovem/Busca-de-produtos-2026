import React, { useState, useEffect } from 'react';
import { ClientPrintFields } from '../types';
import { qrUrl, triggerPrintCard } from '../utils/searchEngine';

interface PrintModalProps {
  currentPrint: ClientPrintFields | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onPrintComplete?: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  currentPrint,
  onClose,
  onToast,
  onPrintComplete
}) => {
  const [printing, setPrinting] = useState(false);

  // Garante que o botão de impressão seja destravado sempre que abrir um novo cliente ou o mesmo
  useEffect(() => {
    setPrinting(false);
  }, [currentPrint]);

  if (!currentPrint) return null;

  const handleClose = () => {
    setPrinting(false);
    onClose();
  };

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const ok = await triggerPrintCard(currentPrint, () => {
        // Callback executado quando o usuário conclui ou cancela a impressão
        setPrinting(false);
        if (onPrintComplete) {
          onPrintComplete();
        } else {
          handleClose();
        }
      });

      if (!ok) {
        onToast('Erro ao abrir janela de impressão.');
        setPrinting(false);
      } else {
        // Destrava o botão com segurança para que novas impressões nunca fiquem presas em loop
        setTimeout(() => {
          setPrinting(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error('Erro ao preparar impressão:', err);
      onToast(err.message || 'Erro ao preparar impressão.');
      setPrinting(false);
    }
  };

  return (
    <div id="printModal" className="modal">
      <div className="modal-card">
        <div className="modal-head">
          <b>Prévia da Ficha de Identificação</b>
          <button id="closeModal" className="close" onClick={handleClose} type="button">
            Fechar
          </button>
        </div>
        <div className="preview">
          <div id="printPreview">
            <div className="print-preview">
              <div className="pp-head">
                <div className="pp-title">
                  <div className="sf">SF</div>
                  <div>
                    <strong>SUPERFÁCIL ATACADO</strong>
                    <small>FICHA DE IDENTIFICAÇÃO DO CLIENTE</small>
                  </div>
                </div>
                <div className="issue">
                  EMISSÃO<br />
                  <b>{currentPrint.date}</b>
                </div>
              </div>

              <div className="pp-body">
                <div className="pp-side">
                  <div>
                    <label>CÓDIGO</label>
                    <div className="pp-code">{currentPrint.code || '---'}</div>
                  </div>
                  <div>
                    <img
                      className="pp-qr"
                      src={qrUrl(currentPrint.code || '')}
                      alt="QR"
                    />
                    <div className="access">ACESSE O SITE</div>
                  </div>
                </div>

                <div className="pp-details">
                  <div>
                    <span className="field-label">RAZÃO SOCIAL</span>
                    <div className="field-value big">
                      {(currentPrint.razao || 'NÃO INFORMADO').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span className="field-label">BAIRRO</span>
                    <div className="field-value">
                      {(currentPrint.bairro || 'NÃO INFORMADO').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span className="field-label">ENDEREÇO</span>
                    <div className="field-value">
                      {(currentPrint.address || 'NÃO INFORMADO').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <span className="field-label">VENDEDOR</span>
                    <div className="field-value">
                      {(currentPrint.vendedor || 'NÃO INFORMADO').toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pp-foot">
                <span>SELO DE CADASTRO HOMOLOGADO</span>
                <span>✓ CLIENTE VERIFICADO</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button id="cancelPrint" className="cancel" onClick={handleClose} type="button">
            Voltar
          </button>
          <button
            id="printBtn"
            className="primary print-main"
            onClick={handlePrint}
            disabled={printing}
            type="button"
          >
            {printing ? 'Preparando impressão...' : '🖨 Imprimir Ficha'}
          </button>
        </div>
      </div>
    </div>
  );
};
