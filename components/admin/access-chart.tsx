"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export type AccessPoint = { label: string; sessions: number; visitors: number };
export function AccessChart({ data }: { data: AccessPoint[] }) {
  return <div className="h-[250px] min-w-0 sm:h-[330px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="sessions" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#17191b" stopOpacity={.25} /><stop offset="100%" stopColor="#17191b" stopOpacity={0} /></linearGradient><linearGradient id="visitors" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e2d700" stopOpacity={.5} /><stop offset="100%" stopColor="#e2d700" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eceff1" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 14 }} /><Legend /><Area type="monotone" name="Acessos" dataKey="sessions" stroke="#17191b" strokeWidth={3} fill="url(#sessions)" /><Area type="monotone" name="Visitantes" dataKey="visitors" stroke="#d2d700" strokeWidth={3} fill="url(#visitors)" /></AreaChart></ResponsiveContainer></div>;
}
