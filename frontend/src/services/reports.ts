import { apiFetch } from './api';

export interface ReportSummary {
  period: { start: string; end: string };
  income: {
    total: number;
    cogs: number;
    count: number;
  };
  expense: {
    total: number;
    costOfGoods: number;
    operating: number;
    equipment: number;
    other: number;
    count: number;
  };
  profit: {
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
  };
}

export interface ReportIncomeRow {
  period: string;
  total: number;
  cogs: number;
  count: number;
}

export interface ReportIncomeChannel {
  channel: string | null;
  total: number;
}

export interface ReportIncomeResponse {
  items: ReportIncomeRow[];
  byChannel: ReportIncomeChannel[];
}

export interface ReportExpenseRow {
  period: string;
  category_name: string | null;
  category_type: string | null;
  total: number;
  count: number;
}

export interface ReportExpenseResponse {
  items: ReportExpenseRow[];
}

export interface ReportStockProduct {
  id: number;
  code: string;
  name: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  stock_value: number;
  total_purchased: number;
  total_sold: number;
  low_stock_alert: number;
}

export interface ReportStockResponse {
  items: ReportStockProduct[];
  totalStockValue: number;
}

export async function fetchReportSummary(startDate: string, endDate: string): Promise<ReportSummary> {
  const q = new URLSearchParams({ startDate, endDate });
  return apiFetch<ReportSummary>(`/reports/summary?${q}`);
}

export async function fetchReportIncome(
  startDate: string,
  endDate: string,
  groupBy?: 'day' | 'month',
): Promise<ReportIncomeResponse> {
  const q = new URLSearchParams({ startDate, endDate });
  if (groupBy) q.set('groupBy', groupBy);
  return apiFetch<ReportIncomeResponse>(`/reports/income?${q}`);
}

export async function fetchReportExpense(
  startDate: string,
  endDate: string,
  groupBy?: 'day' | 'month',
): Promise<ReportExpenseResponse> {
  const q = new URLSearchParams({ startDate, endDate });
  if (groupBy) q.set('groupBy', groupBy);
  return apiFetch<ReportExpenseResponse>(`/reports/expense?${q}`);
}

export async function fetchReportStock(): Promise<ReportStockResponse> {
  return apiFetch<ReportStockResponse>('/reports/stock');
}
