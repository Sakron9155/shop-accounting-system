import { apiFetch } from './api';

export interface Product {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  low_stock_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_purchased?: number;
  total_sold?: number;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
  product_name?: string;
  product_code?: string;
  unit?: string;
}

export interface ProductListResponse {
  items: Product[];
  totalStockValue: number;
}

export interface StockSummaryResponse {
  items: Product[];
  totalStockValue: number;
  lowStockCount: number;
}

export interface StockMovementsResponse {
  items: StockMovement[];
}

export interface CreateProductInput {
  code?: string;
  name: string;
  category?: string;
  unit?: string;
  cost_price?: number;
  sell_price?: number;
  quantity?: number;
  low_stock_alert?: number;
}

export async function fetchProducts(params?: { search?: string; lowStock?: boolean }): Promise<ProductListResponse> {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.lowStock) q.set('lowStock', 'true');
  return apiFetch<ProductListResponse>(`/products?${q}`);
}

export async function fetchProductById(id: number): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  return apiFetch<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: number, data: Partial<CreateProductInput>): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await apiFetch(`/products/${id}`, { method: 'DELETE' });
}

export async function fetchProductMovements(id: number): Promise<StockMovementsResponse> {
  return apiFetch<StockMovementsResponse>(`/products/${id}/movements`);
}

export async function adjustStock(
  id: number,
  quantity: number,
  notes?: string,
): Promise<{ success: boolean; quantityBefore: number; quantityAfter: number }> {
  return apiFetch(`/products/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ quantity, notes }),
  });
}

export async function fetchStockSummary(): Promise<StockSummaryResponse> {
  return apiFetch<StockSummaryResponse>('/stock');
}

export async function fetchStockMovements(params?: {
  productId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<StockMovementsResponse> {
  const q = new URLSearchParams();
  if (params?.productId) q.set('productId', String(params.productId));
  if (params?.type) q.set('type', params.type);
  if (params?.startDate) q.set('startDate', params.startDate);
  if (params?.endDate) q.set('endDate', params.endDate);
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  return apiFetch<StockMovementsResponse>(`/stock/movements?${q}`);
}
