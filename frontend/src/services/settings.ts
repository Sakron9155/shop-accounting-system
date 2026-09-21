import { apiFetch } from './api';

export interface ShopSettings {
  id: number;
  name: string;
  phone: string;
  address: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  type: 'cost_of_goods' | 'operating' | 'equipment' | 'other';
  is_active: boolean;
  sort_order: number;
}

export interface SettingsResponse {
  shop: ShopSettings;
  paymentMethods: PaymentMethod[];
  expenseCategories: ExpenseCategory[];
}

export async function fetchSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>('/settings');
}

export async function updateShopSettings(data: { name: string; phone?: string; address?: string }): Promise<void> {
  await apiFetch('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function createPaymentMethod(name: string): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>('/settings/payment-methods', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function updatePaymentMethod(id: number, name: string): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>(`/settings/payment-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deletePaymentMethod(id: number): Promise<void> {
  await apiFetch(`/settings/payment-methods/${id}`, { method: 'DELETE' });
}

export async function createExpenseCategory(name: string, type: string): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>('/settings/expense-categories', {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  });
}

export async function updateExpenseCategory(id: number, name: string, type?: string): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>(`/settings/expense-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, type }),
  });
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  await apiFetch(`/settings/expense-categories/${id}`, { method: 'DELETE' });
}
