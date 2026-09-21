import { apiFetch } from './api';

export interface DashboardSummary {
  period: { type: string; start: string; end: string };
  summary: {
    totalIncome: number;
    totalCogs: number;
    totalExpense: number;
    operatingExpense: number;
    equipmentExpense: number;
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    netProfitMargin: number;
  };
  stock: {
    totalValue: number;
    productCount: number;
    lowStockCount: number;
  };
}

export interface ChartDataPoint {
  label: string;
  income: number;
  cogs: number;
  expense: number;
  operating: number;
  profit: number;
}

export interface DashboardChart {
  chart: ChartDataPoint[];
  recentIncome: {
    id: number;
    date: string;
    description: string;
    amount: number;
    payment_method: string | null;
  }[];
  recentExpense: {
    id: number;
    date: string;
    description: string;
    amount: number;
    category_name: string | null;
  }[];
}

export async function fetchDashboardSummary(
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DashboardSummary> {
  const params = new URLSearchParams({ period });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return apiFetch<DashboardSummary>(`/dashboard?${params}`);
}

export async function fetchDashboardChart(
  period: string,
  startDate?: string,
  endDate?: string,
): Promise<DashboardChart> {
  const params = new URLSearchParams({ period });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return apiFetch<DashboardChart>(`/dashboard/chart?${params}`);
}
