'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface RevenueChartProps {
  data: { name: string; total: number }[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [mounted, setMounted] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'area'>('area');

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const hasData = data.length > 0;

  const formattedData = data.map((item, index) => ({
    ...item,
    total: item.total,
    fill: index === data.length - 1 ? '#10B981' : '#6366F1',
  }));

  const totalRevenue = data.reduce((acc, item) => acc + item.total, 0);
  const averageRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const maxRevenue = Math.max(...data.map(item => item.total));

  if (!mounted) {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ingresos Mensuales</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Evolución de tus ganancias</p>
          </div>
        </div>
        <div className="h-80 w-full flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 dark:text-gray-400 font-medium">Cargando gráfico...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ingresos Mensuales</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Evolución de tus ganancias</p>
          </div>
        </div>
        <div className="h-80 w-full flex flex-col items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl">
          <div className="p-4 bg-white dark:bg-gray-700 rounded-full shadow-lg mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center font-medium">No hay datos de ingresos disponibles</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Los ingresos aparecerán aquí cuando tengas pedidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ingresos Mensuales</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Evolución de tus ganancias</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
          <button
            onClick={() => setChartType('area')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              chartType === 'area' 
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Área
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              chartType === 'bar' 
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Barras
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-linear-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-600/20 rounded-xl">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-600/20 rounded-xl">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Promedio</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">${Math.round(averageRevenue).toLocaleString()}</p>
        </div>
        <div className="p-4 bg-linear-to-br from-violet-50 to-violet-100 dark:from-violet-500/10 dark:to-violet-600/20 rounded-xl">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wider">Máximo</p>
          <p className="text-xl font-bold text-violet-700 dark:text-violet-300 mt-1">${maxRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-linear-to-br from-amber-50 to-amber-100 dark:from-amber-500/10 dark:to-amber-600/20 rounded-xl">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Meses</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{data.length}</p>
        </div>
      </div>

      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenueDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                tickFormatter={(value) => `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px', 
                  border: '1px solid rgba(229, 231, 235, 0.5)',
                  boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15)' 
                }}
                formatter={(value: any, name: any) => [`$${(Number(value) || 0).toLocaleString()}`, name ?? 'Ingresos']}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#6366F1"
                strokeWidth={3}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          ) : (
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6B7280', fontSize: 12 }} 
                tickFormatter={(value) => `$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px', 
                  border: '1px solid rgba(229, 231, 235, 0.5)',
                  boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15)' 
                }}
                formatter={(value: any) => { 
                  const numericValue = Number(value);
                  return [
                    `$${Number.isNaN(numericValue) ? 0 : numericValue.toLocaleString()}`,
                    'Ingresos'
                  ];
                }}
              />
              <Bar 
                dataKey="total" 
                radius={[6, 6, 4, 4]} 
                barSize={40}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
