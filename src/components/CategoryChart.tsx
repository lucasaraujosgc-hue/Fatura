import React, { useEffect, useState } from "react";
import { fetchTransactions } from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CategoryIcon } from "../lib/iconsList";
import { PieChart as PieChartIcon } from "lucide-react";

export function CategoryChart({
  currentMonth,
  categories,
  refreshKey
}: {
  currentMonth: string;
  categories: any[];
  refreshKey: number;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentMonth) return;
    setLoading(true);
    fetchTransactions(currentMonth)
      .then((transactions) => {
        const byCategory = transactions.reduce((acc: any, tx: any) => {
          const catId = tx.category_id || "none";
          if (!acc[catId]) {
            acc[catId] = { id: catId, value: 0 };
          }
          acc[catId].value += Number(tx.amount) || 0;
          return acc;
        }, {});

        const categoriesMap = categories.reduce(
          (acc, c) => ({ ...acc, [c.id]: c }),
          {}
        );

        const chartData = Object.values(byCategory)
          .map((item: any) => {
            if (item.id === "none") {
              return { name: "Sem Categoria", value: item.value, color: "#64748b" };
            }
            const cat = categoriesMap[item.id];
            return {
              name: cat ? cat.name : "Desconhecida",
              value: item.value,
              color: cat ? cat.color : "#64748b",
            };
          })
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value);

        setData(chartData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentMonth, refreshKey, categories]);

  if (loading) return null;

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-xl text-xs">
          <p className="font-semibold text-slate-100 mb-1">{payload[0].name}</p>
          <p className="text-blue-400 font-medium">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-950/40 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
      <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <span className="text-blue-450"><PieChartIcon size={18} /></span>
        Gastos por Categoria
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
