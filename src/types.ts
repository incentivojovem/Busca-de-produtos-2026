export type CategoryType = 'all' | 'produtos' | 'clientes';
export type RecordCategory = 'produtos' | 'clientes';

export interface DataRow {
  [key: string]: any;
  _docId?: string;
  _sheetTitle?: string;
  _category?: RecordCategory;
  _groupName?: string;
}

export interface SearchMatchedField {
  field: string;
  value: string;
  score: number;
}

export interface SearchResultItem {
  category: RecordCategory;
  record: DataRow;
  score: number;
  quantidade: number | null;
  matchedFields: SearchMatchedField[];
}

export interface ClientPrintFields {
  code: string;
  razao: string;
  cnpj: string;
  address: string;
  bairro: string;
  vendedor: string;
  date: string;
}

export interface ClientExtraFields {
  cnpj?: string;
  bairro?: string;
  fantasia?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  nome?: string;
  empresa?: string;
  status?: string;
  grupo?: string;
}

export interface OsintEmpresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cargo: string;
  situacaoFazenda: 'Ativa' | 'Baixada' | 'Suspensa' | 'Em Análise';
  uf: string;
  cnae: string;
  telefones: string[];
  emails: string[];
}

export interface OsintDossier {
  nomeConsultado: string;
  status: 'validado' | 'multiplos_vinculos' | 'alerta_cadastral' | 'homologado';
  resumoExecutivo: string;
  qualificacaoPrincipal: string;
  empresasVinculadas: OsintEmpresa[];
  telefonesConsolidados: string[];
  emailsConsolidados: string[];
  alertasConformidade: string[];
  conexoesSocietarias: string[];
  dataConsulta?: string;
}

export interface InterpretedOrderItem {
  original: string;
  quantidade: number | null;
  produto_solicitado: string;
  ambiguo: boolean;
  opcoes: Array<{
    codigo: string;
    descricao: string;
    relevancia: number;
  }>;
  selectedCodigo?: string;
  selectedDescricao?: string;
}

export interface OrderControlRow {
  id: number;
  numero: number;
  cliente: string;
  separador: string;
  friosFlv: boolean;
  retirarLoja: boolean;
  observacoes: string;
}

