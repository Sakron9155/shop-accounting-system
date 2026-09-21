import { apiFetch } from './api';

export interface PaymentMethod {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface IncomeItem {
  id: number;
  income_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  cost_price: number;
  subtotal: number;
  product_name?: string;
  product_code?: string;
  unit?: string;
}

export interface Income {
  id: number;
  date: string;
  description: string;
  amount: number;
  payment_method_id: number | null;
  payment_method_name: string | null;
  type: 'general' | 'sale';
  cost_of_goods: number;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: IncomeItem[];
}

export interface IncomeListResponse {
  items: Income[];
  total: string;
  totalCogs: string;
}

export interface DailySummaryRow {
  date: string;
  channels: Record<string, number>;
  total: number;
}

export interface DailySummaryResponse {
  summary: DailySummaryRow[];
}

export interface SaleItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateIncomeInput {
  date: string;
  description: string;
  amount: number;
  payment_method_id?: number | null;
  type?: 'general' | 'sale';
  notes?: string;
  items?: SaleItemInput[];
}

export async function fetchIncomeList(params?: {
  startDate?: string;
  endDate?: string;
  paymentMethodId?: number;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<IncomeListResponse> {
  const q = new URLSearchParams();
  if (params?.startDate) q.set('startDate', params.startDate);
  if (params?.endDate) q.set('endDate', params.endDate);
  if (params?.paymentMethodId) q.set('paymentMethodId', String(params.paymentMethodId));
  if (params?.type) q.set('type', params.type);
  if (params?.search) q.set('search', params.search);
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  return apiFetch<IncomeListResponse>(`/income?${q}`);
}

export async function fetchIncomeDailySummary(startDate: string, endDate: string): Promise<DailySummaryResponse> {
  const q = new URLSearchParams({ startDate, endDate });
  return apiFetch<DailySummaryResponse>(`/income/daily-summary?${q}`);
}

export async function fetchIncomeById(id: number): Promise<Income> {
  return apiFetch<Income>(`/income/${id}`);
}

export async function createIncome(data: CreateIncomeInput): Promise<Income> {
  return apiFetch<Income>('/income', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIncome(
  id: number,
  data: Partial<CreateIncomeInput> & { items?: SaleItemInput[] },
): Promise<Income> {
  return apiFetch<Income>(`/income/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteIncome(id: number): Promise<void> {
  await apiFetch(`/income/${id}`, { method: 'DELETE' });
}
