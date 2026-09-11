"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";

const map = { today: "Hoje", week: "7 dias", month: "30 dias", year: "12 meses" } as const;
export type SalesSeries = Record<keyof typeof map, Array<{ label: string; value: number }>>;
export function SalesChart({ data }: { data: SalesSeries }) {
  const [range, setRange] = useState<keyof typeof map>("week");
  const current = data[range];
  return <section className="metric-card min-w-0 rounded-3xl border border-zinc-200 bg-white p-4 sm:p-6"><div className="mb-6 flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-extrabold">Vendas</h2><p className="text-sm text-zinc-500">Receita confirmada no período</p></div><Tabs className="min-w-0" value={range} onValueChange={(value) => setRange(value as keyof typeof map)}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-auto">{Object.entries(map).map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></Tabs></div><div className="h-[250px] min-w-0 sm:h-[290px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={current} margin={{ top: 10, right: 5, left: -18, bottom: 0 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2d700" stopOpacity={.45} /><stop offset="100%" stopColor="#e2d700" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f2" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#71717a" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#71717a" }} /><Tooltip formatter={(value) => [money(Number(value)), "Vendas"]} contentStyle={{ borderRadius: 14, border: "1px solid #e4e4e7" }} /><Area type="monotone" dataKey="value" stroke="#17191b" strokeWidth={3} fill="url(#salesFill)" /></AreaChart></ResponsiveContainer></div></section>;
}
