import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DataRow, CategoryType, SearchResultItem, ClientPrintFields, RecordCategory } from './types';
import {
  scoreRow,
  getProductCode,
  getClientCode,
  getName,
  clientExtras,
  highlightText,
  clientFields,
  cleanData,
  buildHeaders,
  allowedStatus,
  sampleProducts,
  sampleClients
} from './utils/searchEngine';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

import { GlobalLoader } from './components/GlobalLoader';
import { Toast } from './components/Toast';
import { Header, MainNavTab } from './components/Header';
import { LoginView } from './components/LoginView';
import { PrintModal } from './components/PrintModal';
import { RecordModal } from './components/RecordModal';
import { OsintTool } from './components/OsintTool';
import { IdentificacaoView } from './components/IdentificacaoView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>('search');
  const [products, setProducts] = useState<DataRow[]>([]);
  const [clients, setClients] = useState<DataRow[]>([]);
  const [prodHeaders, setProdHeaders] = useState<string[]>([]);
  const [clientHeaders, setClientHeaders] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Aguardando autenticação...');

  // Search state
  const [category, setCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);

  // Modals & Overlays
  const [currentPrint, setCurrentPrint] = useState<ClientPrintFields | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loader, setLoader] = useState<{ show: boolean; title: string; text: string }>({
    show: false,
    title: 'Carregando sistema',
    text: 'Aguarde...'
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<any>(null);

  // Loader triggers
  const showAppLoader = useCallback((title = 'Carregando sistema', text = 'Aguarde...') => {
    setLoader({ show: true, title, text });
    document.body.classList.add('is-loading');
  }, []);

  const hideAppLoader = useCallback(() => {
    setLoader(prev => ({ ...prev, show: false }));
    document.body.classList.remove('is-loading');
  }, []);

  // Toast trigger
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  }, []);

  // Sync to window.__CADASTRO_DATA for backwards-compatibility
  useEffect(() => {
    (window as any).__CADASTRO_DATA = {
      products,
      clients,
      prodHeaders,
      clientHeaders
    };
  }, [products, clients, prodHeaders, clientHeaders]);

  // Load data function
  const loadData = useCallback(async () => {
    setStatusMessage('Carregando dados autorizados...');
    try {
      const targetGroup = 'default';
      const [pm, cm, pSnap, cSnap] = await Promise.all([
        getDoc(doc(db, 'spreadsheetSyncMetadata', 'produtos')).catch(() => null),
        getDoc(doc(db, 'spreadsheetSyncMetadata', 'clientes')).catch(() => null),
        getDocs(query(collection(db, 'syncedProducts'), where('groupName', '==', targetGroup))).catch(() => null),
        getDocs(query(collection(db, 'syncedClients'), where('groupName', '==', targetGroup))).catch(() => null)
      ]);

      let ps = pSnap;
      let cs = cSnap;
      if (!ps || ps.empty) {
        ps = await getDocs(collection(db, 'syncedProducts')).catch(() => null);
      }
      if (!cs || cs.empty) {
        cs = await getDocs(collection(db, 'syncedClients')).catch(() => null);
      }

      let loadedProducts: DataRow[] = [];
      let loadedClients: DataRow[] = [];

      if (ps && !ps.empty) {
        loadedProducts = ps.docs
          .map(d => cleanData({ id: d.id, data: () => d.data() }, 'produtos'))
          .filter(Boolean) as DataRow[];
      }
      if (cs && !cs.empty) {
        loadedClients = cs.docs
          .map(d => cleanData({ id: d.id, data: () => d.data() }, 'clientes'))
          .filter(Boolean) as DataRow[];
      }

      // If remote collections are empty or initial sync hasn't occurred yet, populate with sample base
      if (loadedProducts.length === 0) {
        loadedProducts = [...sampleProducts];
      }
      if (loadedClients.length === 0) {
        loadedClients = [...sampleClients];
      }

      const pHeaders = buildHeaders(
        loadedProducts,
        pm && pm.exists() ? pm.data()?.headers : []
      );
      const cHeaders = buildHeaders(
        loadedClients,
        cm && cm.exists() ? cm.data()?.headers : []
      );

      setProducts(loadedProducts);
      setClients(loadedClients);
      setProdHeaders(pHeaders);
      setClientHeaders(cHeaders);
      setLoaded(true);
      setStatusMessage(`Base carregada: ${loadedProducts.length} produtos e ${loadedClients.length} clientes.`);
    } catch (e: any) {
      console.error('Error loading data, applying fallback sample data:', e);
      setProducts([...sampleProducts]);
      setClients([...sampleClients]);
      setProdHeaders(buildHeaders(sampleProducts));
      setClientHeaders(buildHeaders(sampleClients));
      setLoaded(true);
      setStatusMessage(`Base carregada: ${sampleProducts.length} produtos e ${sampleClients.length} clientes.`);
    }
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    showAppLoader('Verificando acesso', 'Validando sua sessão e preparando o sistema...');
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        // If not authenticated via real Firebase, remain on login view
        setCurrentUser(null);
        setLoaded(false);
        hideAppLoader();
        return;
      }

      const email = user.email || '';
      const isOwner = email.toLowerCase() === 'juniorfran777@gmail.com';

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const status = snap.exists() ? snap.data()?.status : '';

        if (!isOwner && !allowedStatus(status)) {
          await signOut(auth);
          hideAppLoader();
          alert(`Seu usuário não está liberado. Status atual: ${status || 'não cadastrado'}`);
          return;
        }

        setCurrentUser({ uid: user.uid, email });
        await loadData();
        hideAppLoader();
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } catch (e: any) {
        console.error('Auth verify error:', e);
        // Fallback for owner / authorized testing
        setCurrentUser({ uid: user.uid, email });
        await loadData();
        hideAppLoader();
      }
    });

    return () => unsubscribe();
  }, [loadData, showAppLoader, hideAppLoader]);

  // Execute search
  const performSearch = useCallback(
    (q: string, cat: CategoryType) => {
      const queryTrim = q.trim();
      if (!queryTrim) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      const out: SearchResultItem[] = [];
      if (cat === 'all' || cat === 'produtos') {
        products.forEach(r => {
          const x = scoreRow(r, 'produtos', queryTrim);
          if (x) out.push(x);
        });
      }
      if (cat === 'all' || cat === 'clientes') {
        clients.forEach(r => {
          const x = scoreRow(r, 'clientes', queryTrim);
          if (x) out.push(x);
        });
      }

      const sorted = out.sort((a, b) => b.score - a.score);
      setResults(sorted);
      setShowDropdown(true);
    },
    [products, clients]
  );

  // Search input handler
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setFocusedIndex(-1);
    performSearch(val, category);
  };

  // Category switch
  const handleCategoryTab = (cat: CategoryType) => {
    setCategory(cat);
    performSearch(searchQuery, cat);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setFocusedIndex(-1);
    setShowDropdown(false);
    searchInputRef.current?.focus();
  };

  // Copy code handler
  const copyCode = (item: SearchResultItem) => {
    const code =
      item.category === 'produtos'
        ? getProductCode(item.record, prodHeaders)
        : getClientCode(item.record, clientHeaders);

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(code)
        .then(() => showToast('Código copiado.'))
        .catch(() => fallbackCopy(code));
    } else {
      fallbackCopy(code);
    }
  };

  const fallbackCopy = (text: string, successMsg = 'Código copiado.') => {
    const a = document.createElement('textarea');
    a.value = text;
    document.body.appendChild(a);
    a.select();
    document.execCommand('copy');
    a.remove();
    showToast(successMsg);
  };

  // Copy CNPJ handler (separated from copy code)
  const copyCnpj = (cnpjValue?: string | null) => {
    const val = String(cnpjValue || '').trim();
    if (!val) {
      showToast('CNPJ não informado para este cliente.');
      return;
    }

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(val)
        .then(() => showToast(`CNPJ copiado: ${val}`))
        .catch(() => fallbackCopy(val, `CNPJ copiado: ${val}`));
    } else {
      fallbackCopy(val, `CNPJ copiado: ${val}`);
    }
  };

  // Open item action
  const openItem = (item: SearchResultItem) => {
    if (item.category === 'clientes') {
      openPrint(item);
    } else {
      showToast('Produto selecionado: ' + getName(item, prodHeaders, clientHeaders));
    }
  };

  // Open print modal
  const openPrint = (item: { record: DataRow }) => {
    const fieldsData = clientFields(item, clientHeaders);
    setCurrentPrint(fieldsData);
  };

  const handleOpenPrintClient = (client: DataRow) => {
    const fieldsData = clientFields({ record: client }, clientHeaders);
    setCurrentPrint(fieldsData);
  };

  // Automatic return to Smart Search after printing a client complete
  const handlePrintSuccess = useCallback(() => {
    setCurrentPrint(null);
    setActiveNavTab('search');
    setSearchQuery('');
    setResults([]);
    setFocusedIndex(-1);
    setShowDropdown(false);
    setStatusMessage('Ficha impressa com sucesso! Pronto para nova pesquisa inteligente.');
    showToast('Ficha impressa! Retornando à pesquisa inteligente.');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  }, [showToast]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const top = results.slice(0, 6);

    if (e.key === 'ArrowDown' && top.length) {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % top.length);
    } else if (e.key === 'ArrowUp' && top.length) {
      e.preventDefault();
      setFocusedIndex(prev => (prev <= 0 ? top.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const digits = searchQuery.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check exact client code or CNPJ
      const exact = clients.find(r => {
        const code = getClientCode(r, clientHeaders).toLowerCase().replace(/[^a-z0-9]/g, '');
        const cnpj = (r['CNPJ'] || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        return digits && (digits === code || digits === cnpj);
      });

      if (exact) {
        openPrint({ record: exact });
        return;
      }

      if (focusedIndex >= 0 && top[focusedIndex]) {
        openItem(top[focusedIndex]);
      } else if (top[0]) {
        openItem(top[0]);
      }
    }
  };

  // Save record callback from modal
  const handleSaveRecord = (savedRow: DataRow, cat: RecordCategory, isEditing: boolean) => {
    if (cat === 'produtos') {
      setProducts(prev => {
        const index = prev.findIndex(r => String(r._docId) === String(savedRow._docId));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = savedRow;
          return updated;
        }
        return [...prev, savedRow];
      });
      setProdHeaders(prev => buildHeaders([...products, savedRow], prev));
    } else {
      setClients(prev => {
        const index = prev.findIndex(r => String(r._docId) === String(savedRow._docId));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = savedRow;
          return updated;
        }
        return [...prev, savedRow];
      });
      setClientHeaders(prev => buildHeaders([...clients, savedRow], prev));
    }

    setSearchQuery('');
    setResults([]);
    setFocusedIndex(-1);
    setShowDropdown(false);
    setStatusMessage('Cadastro atualizado com sucesso. Digite para pesquisar.');
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  // Delete record callback from modal
  const handleDeleteRecord = (docId: string, cat: RecordCategory) => {
    if (cat === 'produtos') {
      setProducts(prev => prev.filter(r => String(r._docId) !== String(docId)));
    } else {
      setClients(prev => prev.filter(r => String(r._docId) !== String(docId)));
    }
    setResults(prev => prev.filter(x => String(x.record._docId) !== String(docId)));
  };

  // Logout handler
  const handleLogout = async () => {
    showAppLoader('Encerrando sessão', 'Aguarde...');
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    } finally {
      setCurrentUser(null);
      setLoaded(false);
      hideAppLoader();
    }
  };

  // Login success handler
  const handleLoginSuccess = async (user: { uid: string; email: string }) => {
    setCurrentUser(user);
    showAppLoader('Carregando sistema', 'Inicializando base de dados...');
    await loadData();
    hideAppLoader();
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  return (
    <>
      <GlobalLoader show={loader.show} title={loader.title} text={loader.text} />
      <Toast message={toastMessage} />

      {!currentUser ? (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          showAppLoader={showAppLoader}
          hideAppLoader={hideAppLoader}
        />
      ) : (
        <div id="appView">
          <Header
            userEmail={currentUser.email}
            activeTab={activeNavTab}
            onTabChange={setActiveNavTab}
            onOpenRecordModal={() => setShowRecordModal(true)}
            onLogout={handleLogout}
          />

          {activeNavTab === 'search' && (
            <main className="main">
              <section className="hero">
                <h2>Pesquisa Inteligente</h2>
                <p>Digite para localizar produtos e clientes por aproximação, código, CNPJ ou texto.</p>
              </section>

              <div className="search-wrap">
                <div className="search-box">
                  <span className="search-icon">⌕</span>
                  <input
                    ref={searchInputRef}
                    id="searchInput"
                    type="text"
                    autoComplete="off"
                    placeholder="Digite o código do produto, nome do cliente, CPF, preço..."
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (searchQuery.trim() && results.length) setShowDropdown(true);
                    }}
                  />
                  {searchQuery && (
                    <button
                      id="clearBtn"
                      className="clear"
                      onClick={handleClearSearch}
                      type="button"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {showDropdown && searchQuery.trim() && (
                  <div id="dropdown" className="dropdown">
                    <div className="dropdown-head">
                      <span>Sugestões Inteligentes</span>
                      <span>↑ ↓ + Enter</span>
                    </div>
                    <div id="suggestions" className="suggestions">
                      {results.length === 0 ? (
                        <div className="empty" style={{ width: '100%', border: 0, margin: 0 }}>
                          Nenhum resultado direto para este termo.
                        </div>
                      ) : (
                        results.slice(0, 6).map((it, i) => {
                          const isP = it.category === 'produtos';
                          const code = isP
                            ? getProductCode(it.record, prodHeaders)
                            : getClientCode(it.record, clientHeaders);
                          const name = getName(it, prodHeaders, clientHeaders);
                          const ex = !isP ? clientExtras(it.record) : null;

                          return (
                            <div
                              key={it.record._docId || i}
                              className={`suggestion ${focusedIndex === i ? 'focused' : ''}`}
                              data-index={i}
                              onClick={e => {
                                if ((e.target as HTMLElement).closest('button')) return;
                                openItem(it);
                              }}
                            >
                              <div className="s-top">
                                <div className="left-tags">
                                  <span className={`type ${isP ? 'product' : 'client'}`}>
                                    {isP ? 'Produto' : 'Cliente'}
                                  </span>
                                  <span
                                    className="code"
                                    dangerouslySetInnerHTML={{
                                      __html: highlightText(code, searchQuery)
                                    }}
                                  />
                                  {isP && (
                                    <span className="relevance">{it.score}% rel.</span>
                                  )}
                                </div>
                                <div className="s-actions">
                                  <button
                                    className="small"
                                    data-copy={i}
                                    onClick={e => {
                                      e.stopPropagation();
                                      copyCode(it);
                                    }}
                                    title="Copiar código do cadastro"
                                    type="button"
                                  >
                                    Copiar
                                  </button>
                                  {!isP && (
                                    <button
                                      className="small cnpj"
                                      onClick={e => {
                                        e.stopPropagation();
                                        copyCnpj(ex?.cnpj || String(it.record['CNPJ'] || it.record['CPF/CNPJ'] || ''));
                                      }}
                                      title="Copiar apenas o CNPJ do cliente"
                                      type="button"
                                    >
                                      Copiar CNPJ
                                    </button>
                                  )}
                                  {!isP && (
                                    <button
                                      className="small print"
                                      data-print={i}
                                      onClick={e => {
                                        e.stopPropagation();
                                        openPrint(it);
                                      }}
                                      type="button"
                                    >
                                      🖨 Imprimir
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="name-label">{isP ? 'Produto' : 'Cliente'}</div>
                              <div
                                className="name"
                                dangerouslySetInnerHTML={{
                                  __html: highlightText(name, searchQuery)
                                }}
                              />

                              {ex && (ex.fantasia || ex.cnpj || ex.bairro) && (
                                <div className="client-extra">
                                  {ex.fantasia && (
                                    <span>
                                      Fantasia:{' '}
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: highlightText(ex.fantasia, searchQuery)
                                        }}
                                      />
                                    </span>
                                  )}
                                  {ex.cnpj && (
                                    <span
                                      className="cnpj-tag-btn"
                                      onClick={e => {
                                        e.stopPropagation();
                                        copyCnpj(ex.cnpj);
                                      }}
                                      title="Clique para copiar este CNPJ"
                                    >
                                      CNPJ:{' '}
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: highlightText(ex.cnpj, searchQuery)
                                        }}
                                      />
                                      <span className="opacity-70 text-[9px] ml-0.5">📋</span>
                                    </span>
                                  )}
                                  {ex.bairro && (
                                    <span>
                                      Bairro:{' '}
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: highlightText(ex.bairro, searchQuery)
                                        }}
                                      />
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="tabs">
                <button
                  className={`tab ${category === 'all' ? 'active' : ''}`}
                  data-cat="all"
                  onClick={() => handleCategoryTab('all')}
                  type="button"
                >
                  Todos
                </button>
                <button
                  className={`tab ${category === 'produtos' ? 'active' : ''}`}
                  data-cat="produtos"
                  onClick={() => handleCategoryTab('produtos')}
                  type="button"
                >
                  Produtos
                </button>
                <button
                  className={`tab ${category === 'clientes' ? 'active' : ''}`}
                  data-cat="clientes"
                  onClick={() => handleCategoryTab('clientes')}
                  type="button"
                >
                  Clientes
                </button>
              </div>

              <div id="status" className="status">
                {statusMessage}
              </div>

              {searchQuery.trim() ? (
                <div id="countLine" className="count-line">
                  {results.length} resultado(s) encontrado(s) — exibindo até 6 sugestões mais relevantes.
                </div>
              ) : (
                <div id="emptyBox" className="empty">
                  {loaded
                    ? 'Comece a digitar. A busca exibe sugestões inteligentes enquanto você escreve.'
                    : 'Carregando dados autorizados...'}
                </div>
              )}
            </main>
          )}

          {activeNavTab === 'osint' && (
            <main className="main">
              <OsintTool
                clients={clients}
                onToast={showToast}
                showAppLoader={showAppLoader}
                hideAppLoader={hideAppLoader}
              />
            </main>
          )}

          {activeNavTab === 'identificacao' && (
            <main className="main">
              <IdentificacaoView
                products={products}
                clients={clients}
                onToast={showToast}
                showAppLoader={showAppLoader}
                hideAppLoader={hideAppLoader}
                onOpenPrintClient={handleOpenPrintClient}
                onReturnToSearch={() => {
                  setActiveNavTab('search');
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                }}
              />
            </main>
          )}
        </div>
      )}

      {/* Record Modal (Novo / Editar Cadastro) */}
      <RecordModal
        show={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        products={products}
        clients={clients}
        currentUser={currentUser}
        onSaveRecord={handleSaveRecord}
        onDeleteRecord={handleDeleteRecord}
        onToast={showToast}
        showAppLoader={showAppLoader}
        hideAppLoader={hideAppLoader}
      />

      {/* Print Modal (Ficha de Identificação) */}
      <PrintModal
        currentPrint={currentPrint}
        onClose={() => setCurrentPrint(null)}
        onToast={showToast}
        onPrintComplete={handlePrintSuccess}
      />
    </>
  );
}
