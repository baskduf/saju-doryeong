"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FiveElements } from "../../../lib/fortune";

type Props = {
  elements: FiveElements;
};

const COLORS = ["#6a994e", "#bc4749", "#a98467", "#6c757d", "#3a86ff"];

export function FiveElementsChart({ elements }: Props) {
  const data = [
    { name: "목(木)", value: elements.wood },
    { name: "화(火)", value: elements.fire },
    { name: "토(土)", value: elements.earth },
    { name: "금(金)", value: elements.metal },
    { name: "수(水)", value: elements.water },
  ];

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7c8a1" />
          <XAxis dataKey="name" tick={{ fill: "#5a4632", fontSize: 13 }} />
          <YAxis tick={{ fill: "#5a4632", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(80, 60, 25, 0.06)" }}
            contentStyle={{
              border: "1px solid #cbb68b",
              borderRadius: "10px",
              backgroundColor: "#fffaf1",
              color: "#2e251b",
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
