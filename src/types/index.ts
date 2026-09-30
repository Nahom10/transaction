export type EntryKind =
  | 'sales_deposited'
  | 'telebirr_sales'
  | 'telebirr_to_cbe'
  | 'telebirr_to_dashen'
  | 'dashen_to_telebirr'
  | 'cbe_to_telebirr'
  | 'paid_supplier';

export interface Account {
  id: number;
  name: string;
  opening_balance: number;
  statement_balance: number;
}

export interface AccountBalance {
  id: number;
  name: string;
  opening: number;
  money_in: number;
  money_out: number;
  balance: number;
  statement_balance: number;
}

export interface Entry {
  id: string;
  entry_date: string;
  kind: EntryKind;
  amount: number;
  paid_from: number | null;
  note: string | null;
  receipt_path: string | null;
  created_at: string;
  // joined
  paid_from_account?: { name: string } | null;
}

export const KIND_LABELS: Record<EntryKind, string> = {
  sales_deposited:    'Sales deposited to Dashen',
  telebirr_sales:     'Telebirr sales received',
  telebirr_to_cbe:    'Telebirr → CBE',
  telebirr_to_dashen: 'Telebirr → Dashen',
  dashen_to_telebirr: 'Dashen → Telebirr',
  cbe_to_telebirr:    'CBE → Telebirr',
  paid_supplier:      'Paid supplier',
};

export const KIND_FROM_TO: Record<EntryKind, { from?: string; to?: string }> = {
  sales_deposited:    { to: 'Dashen Bank' },
  telebirr_sales:     { to: 'Telebirr' },
  telebirr_to_cbe:    { from: 'Telebirr', to: 'CBE' },
  telebirr_to_dashen: { from: 'Telebirr', to: 'Dashen Bank' },
  dashen_to_telebirr: { from: 'Dashen Bank', to: 'Telebirr' },
  cbe_to_telebirr:    { from: 'CBE', to: 'Telebirr' },
  paid_supplier:      {},
};
