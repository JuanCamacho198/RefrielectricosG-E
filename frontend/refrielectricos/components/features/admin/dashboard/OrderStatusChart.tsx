'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OrderStatusChartProps {
  data: { name: string; value: number }[];
}

const COLORS = {
  PENDING: { main: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
  PAID: { main: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
  SHIPPED: { main: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
  DELIVERED: { main: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
  CANCELLED: { main: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  PAID: '💳',
  SHIPPED: '📦',
  DELIVERED: '✅',
  CANCELLED: '❌',
};

export default function OrderStatusChart({ data }: OrderStatusChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const chartData = data.map(item => ({
    name: STATUS_LABELS[item.name] || item.name,
    value: item.value,
    color: COLORS[item.name as keyof typeof COLORS]?.main || '#9CA3AF',
    bg: COLORS[item.name as keyof typeof COLORS]?.bg || 'rgba(156, 163, 175, 0.1)',
    icon: STATUS_ICONS[item.name] || '📋',
  }));

  const hasData = chartData.length > 0 && chartData.some(item => item.value > 0);
  const totalOrders = chartData.reduce((acc, item) => acc + item.value, 0);

  if (!mounted) {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Estado de Pedidos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Distribución por estado</p>
        </div>
        <div className="h-[280px] w-full flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 dark:text-gray-400 font-medium">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Estado de Pedidos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Distribución por estado</p>
        </div>
        <div className="h-[280px] w-full flex flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl">
          <div className="p-4 bg-white dark:bg-gray-700 rounded-full shadow-lg mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center font-medium">No hay pedidos aún</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Los estados aparecerán aquí cuando tengas pedidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Estado de Pedidos</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Distribución por estado</p>
        </div>
        <div className="px-4 py-2 bg-linear-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-xl">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Total</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="h-[220px] w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    strokeWidth={0}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px', 
                  border: '1px solid rgba(229, 231, 235, 0.5)',
                  boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15)',
                }}
                formatter={(value: any, name: string) => [`${value ?? 0} pedidos`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {chartData.map((item, index) => {
            const percentage = totalOrders > 0 ? ((item.value / totalOrders) * 100).toFixed(1) : 0;
            return (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-xl bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-600"
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-sm"
                  style={{ backgroundColor: item.bg }}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.value} pedidos ({percentage}%)</p>
                </div>
                <div 
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
