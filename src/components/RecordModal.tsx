import React, { useState, useEffect, useId } from 'react';
import { DataRow, RecordCategory } from '../types';
import {
  fields,
  rowValue,
  rowName,
  lookupScore,
  checkDuplicate,
  generateSearchTokens,
  findExistingKey,
  esc,
  norm
} from '../utils/searchEngine';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';

interface RecordModalProps {
  show: boolean;
  onClose: () => void;
  products: DataRow[];
  clients: DataRow[];
  currentUser: { uid: string; email?: string } | null;
  onSaveRecord: (savedRow: DataRow, category: RecordCategory, isEditing: boolean) => void;
  onDeleteRecord: (docId: string, category: RecordCategory) => void;
  onToast: (msg: string) => void;
  showAppLoader: (title: string, text: string) => void;
  hideAppLoader: () => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  show,
  onClose,
  products,
  clients,
  currentUser,
  onSaveRecord,
  onDeleteRecord,
  onToast,
  showAppLoader,
  hideAppLoader
}) => {
  const [recordCat, setRecordCat] = useState<RecordCategory>('produtos');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<DataRow | null>(null);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<{ row: DataRow; score: number }[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize or reset form on open or category switch
  useEffect(() => {
    if (show) {
      if (!editingDocId) {
        resetForm();
      }
    }
  }, [show, recordCat]);

  // Lookup results updater
  useEffect(() => {
    const q = lookupQuery.trim();
    if (!q) {
      setLookupResults([]);
      return;
    }
    const currentRows = recordCat === 'produtos' ? products : clients;
    const matches = currentRows
      .map(row => ({ row, score: lookupScore(row, q, recordCat) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setLookupResults(matches);
  }, [lookupQuery, recordCat, products, clients]);

  if (!show) return null;

  const resetForm = () => {
    setEditingDocId(null);
    setEditingOriginal(null);
    setFormData({});
    setLookupQuery('');
    setLookupResults([]);
    setNotice(null);
  };

  const handleSwitchCategory = (cat: RecordCategory) => {
    setRecordCat(cat);
    resetForm();
  };

  const handleFieldChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleAutoCode = () => {
    const prefix = recordCat === 'produtos' ? 'PRD-' : 'CLI-';
    const code = prefix + Math.floor(1000 + Math.random() * 90000);
    handleFieldChange('Código', code);
  };

  const handleStartEdit = (row: DataRow) => {
    setEditingDocId(row._docId || '');
    setEditingOriginal(row);
    const newForm: Record<string, string> = {};
    const catFields = fields[recordCat];
    catFields.forEach(f => {
      newForm[f] = rowValue(row, f);
    });
    setFormData(newForm);
    setLookupQuery(rowValue(row, 'Código') || rowValue(row, 'CNPJ') || rowName(row, recordCat));
    setNotice({
      text: 'Cadastro existente carregado. Altere os campos desejados e salve as alterações.',
      type: 'ok'
    });
  };

  const handleDelete = async (docId: string, row: DataRow) => {
    const name = rowName(row, recordCat);
    const code = rowValue(row, 'Código');
    const label = recordCat === 'produtos' ? 'produto' : 'cliente';
    const detail = code ? `Código: ${code} — ${name}` : name;

    if (!window.confirm(`Excluir este ${label}?\n\n${detail}\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    showAppLoader('Excluindo cadastro', 'Removendo o registro e atualizando a pesquisa...');
    try {
      const coll = recordCat === 'produtos' ? 'syncedProducts' : 'syncedClients';
      // Attempt remote delete
      try {
        await deleteDoc(doc(db, coll, String(docId)));
        const metaRef = doc(db, 'spreadsheetSyncMetadata', recordCat);
        const metaSnap = await getDoc(metaRef);
        if (metaSnap.exists()) {
          const n = Number(metaSnap.data()?.totalRows);
          if (Number.isFinite(n) && n > 0) {
            await updateDoc(metaRef, {
              totalRows: Math.max(0, n - 1),
              lastUpdatedAt: serverTimestamp()
            });
          }
        }
      } catch (err) {
        console.warn('Firestore remote delete notice (fallback to local):', err);
      }

      onDeleteRecord(docId, recordCat);
      setLookupQuery('');
      setLookupResults([]);
      if (editingDocId === docId) {
        resetForm();
      }
      onToast('Cadastro excluído com sucesso.');
    } catch (e: any) {
      console.error(e);
      onToast('Não foi possível excluir: ' + (e.message || e.code || 'erro'));
    } finally {
      hideAppLoader();
    }
  };

  const handleSave = async () => {
    const hasValues = Object.values(formData).some(v => v && v.trim());
    if (!hasValues) {
      setNotice({ text: 'Preencha pelo menos um campo principal.', type: 'err' });
      return;
    }

    const currentRows = recordCat === 'produtos' ? products : clients;
    const duplicate = checkDuplicate(formData, recordCat, currentRows, editingDocId);
    if (duplicate) {
      const catName = recordCat === 'produtos' ? 'produto' : 'cliente';
      const msg = `Já existe outro ${catName} com o mesmo ${duplicate.label}. Deseja continuar mesmo assim?`;
      if (!window.confirm(msg)) {
        return;
      }
    }

    setSaving(true);
    const isEditing = Boolean(editingDocId);
    showAppLoader(
      isEditing ? 'Atualizando cadastro' : 'Salvando cadastro',
      isEditing ? 'Gravando as alterações e atualizando a pesquisa...' : 'Gravando o cadastro e atualizando a pesquisa...'
    );

    try {
      const coll = recordCat === 'produtos' ? 'syncedProducts' : 'syncedClients';
      let docId = editingDocId;
      let finalData: Record<string, any> = {};

      if (isEditing) {
        const now: Record<string, any> = Object.fromEntries(
          Object.entries(editingOriginal || {}).filter(([k]) => !k.startsWith('_'))
        );
        Object.entries(formData).forEach(([k, v]) => {
          now[findExistingKey(now, k)] = String(v ?? '').trim();
        });
        finalData = now;
        const tokens = generateSearchTokens(now);

        try {
          await setDoc(
            doc(db, coll, String(editingDocId)),
            {
              data: now,
              searchTokens: tokens,
              updatedAt: serverTimestamp(),
              updatedByUid: currentUser?.uid || 'anonymous',
              updatedByEmail: currentUser?.email || ''
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore setDoc notice (using local update):', err);
        }

        onToast('Cadastro atualizado com sucesso.');
      } else {
        const clean: Record<string, any> = {};
        Object.entries(formData).forEach(([k, v]) => {
          clean[k] = String(v ?? '').trim();
        });
        finalData = clean;
        const tokens = generateSearchTokens(clean);
        const ts = Date.now();
        docId = `default_${recordCat}_manual_${ts}_${Math.random().toString(36).slice(2, 7)}`;

        try {
          await setDoc(doc(db, coll, docId), {
            docId,
            spreadsheetId: 'manual_cadastro',
            sheetTitle: recordCat === 'produtos' ? 'Produtos' : 'Clientes',
            groupName: 'default',
            category: recordCat,
            rowNumber: ts,
            data: clean,
            searchTokens: tokens,
            syncedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncedByUid: currentUser?.uid || 'anonymous',
            syncedByEmail: currentUser?.email || 'user@app.com'
          });

          const mref = doc(db, 'spreadsheetSyncMetadata', recordCat);
          const ms = await getDoc(mref);
          const old = ms.exists() && Array.isArray(ms.data()?.headers) ? ms.data()?.headers : [];
          await setDoc(
            mref,
            {
              category: recordCat,
              spreadsheetId: 'manual_cadastro',
              sheetTitle: recordCat === 'produtos' ? 'Produtos' : 'Clientes',
              headers: Array.from(new Set([...old, ...Object.keys(clean)])),
              totalRows: increment(1),
              lastSyncedAt: serverTimestamp(),
              syncedByUid: currentUser?.uid || 'anonymous',
              syncedByEmail: currentUser?.email || 'user@app.com',
              sourceType: 'excel_file',
              sourceName: 'Cadastro Manual',
              status: 'synced',
              groupName: 'default'
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore write notice (using local store):', err);
        }

        onToast('Cadastro salvo com sucesso.');
      }

      const localRow: DataRow = {
        ...finalData,
        _docId: docId || '',
        _sheetTitle: recordCat === 'produtos' ? 'Produtos' : 'Clientes',
        _category: recordCat,
        _groupName: 'default'
      };

      onSaveRecord(localRow, recordCat, isEditing);
      resetForm();
      onClose();
    } catch (e: any) {
      console.error(e);
      setNotice({ text: 'Erro ao salvar: ' + (e.message || e.code || e), type: 'err' });
    } finally {
      setSaving(false);
      hideAppLoader();
    }
  };

  return (
    <div id="recordModal" className="modal">
      <div className="modal-card">
        <div className="modal-head">
          <b>Cadastro Manual</b>
          <button id="closeRecordModal" className="close" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="record-tabs">
          <button
            type="button"
            className={`record-tab ${recordCat === 'produtos' ? 'active' : ''}`}
            data-record-cat="produtos"
            onClick={() => handleSwitchCategory('produtos')}
          >
            📦 Produto
          </button>
          <button
            type="button"
            className={`record-tab ${recordCat === 'clientes' ? 'active' : ''}`}
            data-record-cat="clientes"
            onClick={() => handleSwitchCategory('clientes')}
          >
            👥 Cliente
          </button>
        </div>

        <div className="form-tools">
          <button id="autoCodeBtn" className="secondary" type="button" onClick={handleAutoCode}>
            Gerar código
          </button>
          <button id="resetRecordBtn" className="secondary" type="button" onClick={resetForm}>
            Limpar formulário
          </button>
          <span id="recordMode" style={{ fontSize: '11px', color: '#64748b' }}>
            {editingDocId ? (
              <>
                Editando cadastro existente <span className="mode-badge">Edição</span>
              </>
            ) : (
              'Novo cadastro'
            )}
          </span>
        </div>

        <div className="lookup-panel">
          <label className="lookup-label">Localizar cadastro existente para editar</label>
          <div className="lookup-row">
            <input
              id="recordLookup"
              type="search"
              placeholder="Digite código, CNPJ ou nome..."
              autoComplete="off"
              value={lookupQuery}
              onChange={e => setLookupQuery(e.target.value)}
            />
          </div>
          <div id="lookupResult" className="lookup-result">
            {lookupQuery.trim() && lookupResults.length === 0 && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Nenhum cadastro encontrado. Você pode criar um novo registro.
              </div>
            )}
            {lookupResults.map(({ row }) => {
              const code = rowValue(row, 'Código');
              const name = rowName(row, recordCat);
              const extra =
                recordCat === 'clientes'
                  ? rowValue(row, 'CNPJ') || rowValue(row, 'Nome Fantasia')
                  : rowValue(row, 'Código de Barras') || rowValue(row, 'Preço');

              return (
                <div key={row._docId} className="lookup-item">
                  <div className="lookup-item-main">
                    <div className="lookup-item-name">{name}</div>
                    <div className="lookup-item-meta">
                      {code ? `Código: ${code} · ` : ''}
                      {extra || 'Cadastro existente'}
                    </div>
                  </div>
                  <div className="lookup-actions" style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => handleStartEdit(row)}
                    >
                      ✎ Editar dados
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      title="Excluir cadastro"
                      aria-label="Excluir cadastro"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(row._docId || '', row);
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {notice && (
          <div id="recordNotice">
            <div className={`notice ${notice.type}`}>{notice.text}</div>
          </div>
        )}

        <div id="recordForm" className="form-grid">
          {fields[recordCat].map(fieldName => {
            const isFull =
              recordCat === 'clientes' &&
              ['Endereço', 'Limite de Crédito'].includes(fieldName);

            return (
              <div
                key={fieldName}
                className={`form-field ${isFull ? 'full' : ''}`}
              >
                <label>{fieldName}</label>
                <input
                  data-field={fieldName}
                  placeholder={fieldName}
                  value={formData[fieldName] || ''}
                  onChange={e => handleFieldChange(fieldName, e.target.value)}
                />
              </div>
            );
          })}
        </div>

        <div className="modal-foot">
          <button id="cancelRecord" className="cancel" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            id="saveRecordBtn"
            className="primary"
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving
              ? editingDocId
                ? 'Salvando alterações...'
                : 'Salvando...'
              : editingDocId
              ? 'Salvar alterações'
              : 'Salvar e Indexar'}
          </button>
        </div>
      </div>
    </div>
  );
};
