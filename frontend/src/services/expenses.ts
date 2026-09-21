import { apiFetch } from './api';

export interface ExpenseCategory {
  id: number;
  name: string;
  type: 'cost_of_goods' | 'operating' | 'equipment' | 'other';
  is_active: boolean;
  sort_order: number;
}

export interface ExpenseItem {
  id: number;
  expense_id: number;
  product_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_name?: string;
  product_code?: string;
  unit?: string;
}

export interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  expense_category_id: number | null;
  category_name: string | null;
  category_type: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: ExpenseItem[];
}

export interface ExpenseListResponse {
  items: Expense[];
  summary: Record<string, number>;
}

export interface ExpenseItemInput {
  product_id?: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface CreateExpenseInput {
  date: string;
  description: string;
  amount: number;
  expense_category_id?: number | null;
  notes?: string;
  items?: ExpenseItemInput[];
}

export interface BatchExpenseItemInput {
  expense_category_id?: number | null;
  category?: string;
  description: string;
  amount: number;
  notes?: string;
  product_id?: number | null;
  quantity?: number;
  unit_price?: number;
}

export interface CreateExpenseBatchInput {
  date: string;
  note?: string;
  notes?: string;
  items: BatchExpenseItemInput[];
}

export async function fetchExpenseList(params?: {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ExpenseListResponse> {
  const q = new URLSearchParams();
  if (params?.startDate) q.set('startDate', params.startDate);
  if (params?.endDate) q.set('endDate', params.endDate);
  if (params?.categoryId) q.set('categoryId', String(params.categoryId));
  if (params?.search) q.set('search', params.search);
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  return apiFetch<ExpenseListResponse>(`/expenses?${q}`);
}

export async function fetchExpenseById(id: number): Promise<Expense> {
  return apiFetch<Expense>(`/expenses/${id}`);
}

export async function createExpense(data: CreateExpenseInput): Promise<Expense> {
  return apiFetch<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createExpenseBatch(
  data: CreateExpenseBatchInput,
): Promise<{ count: number; items: Expense[] }> {
  return apiFetch<{ count: number; items: Expense[] }>('/expenses/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface UpdateExpenseItemInput {
  product_id?: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface UpdateExpenseInput {
  date?: string;
  description?: string;
  amount?: number;
  expense_category_id?: number | null;
  notes?: string;
  items?: UpdateExpenseItemInput[];
}

export async function updateExpense(id: number, data: UpdateExpenseInput): Promise<Expense> {
  return apiFetch<Expense>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: number): Promise<void> {
  await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
}
