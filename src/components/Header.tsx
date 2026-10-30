import React from 'react';
import { Search, ShieldAlert, ClipboardList } from 'lucide-react';

export type MainNavTab = 'search' | 'osint' | 'identificacao';

interface HeaderProps {
  userEmail: string;
  activeTab: MainNavTab;
  onTabChange: (tab: MainNavTab) => void;
  onOpenRecordModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userEmail,
  activeTab,
  onTabChange,
  onOpenRecordModal,
  onLogout
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/20">
            SF
          </div>
          <div>
            <div className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Busca de Produtos e Clientes
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px]">
              {userEmail}
            </div>
          </div>
        </div>

        {/* Center Nav Modules */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => onTabChange('search')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Pesquisa & Cadastros
          </button>

          <button
            type="button"
            onClick={() => onTabChange('osint')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'osint'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Inteligência Cadastral (OSINT)
          </button>

          <button
            type="button"
            onClick={() => onTabChange('identificacao')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'identificacao'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Controle de Pedidos & Fichas
          </button>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="newRecordBtn"
            className="new-record"
            onClick={onOpenRecordModal}
            type="button"
          >
            ＋ Cadastro
          </button>
          <button id="logoutBtn" className="logout" onClick={onLogout} type="button">
            Sair
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-3 py-1.5 justify-around text-xs font-bold">
        <button
          type="button"
          onClick={() => onTabChange('search')}
          className={`py-1 px-2 rounded-lg flex items-center gap-1 ${
            activeTab === 'search' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Pesquisa
        </button>
        <button
          type="button"
          onClick={() => onTabChange('osint')}
          className={`py-1 px-2 rounded-lg flex items-center gap-1 ${
            activeTab === 'osint' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          OSINT
        </button>
        <button
          type="button"
          onClick={() => onTabChange('identificacao')}
          className={`py-1 px-2 rounded-lg flex items-center gap-1 ${
            activeTab === 'identificacao' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Pedidos
        </button>
      </div>
    </header>
  );
};
