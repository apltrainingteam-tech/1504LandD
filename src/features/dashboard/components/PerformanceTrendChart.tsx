import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const mockData = [
  { month: "Apr", metric1: 60, metric2: 55 },
  { month: "May", metric1: 70, metric2: 65 },
  { month: "Jun", metric1: 75, metric2: 68 },
];

import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTrendData } from '../hooks/useTrendData';
import { UnifiedRecord } from '../../../types/reports';

interface PerformanceTrendChartProps {
  trainingType: string;
  rawUnified: UnifiedRecord[];
  chartType: "line" | "bar" | "hybrid";
}

const labelMap: Record<string, [string, string]> = { 
  IP: ["Test Score", "Trainability Score"], 
  AP: ["Knowledge", "BSE"], 
  MIP: ["Science Score", "Skill Score"] 
};

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({ 
  trainingType, 
  rawUnified,
  chartType
}) => {
  const chartData = useTrendData(rawUnified);
  const [label1, label2] = labelMap[trainingType] || ["Metric 1", "Metric 2"];
  const isDualAxis = trainingType === "IP";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8F0" />
        <XAxis 
          dataKey="month" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
        />
        <YAxis 
          yAxisId="left"
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          domain={[0, 100]}
        />
        {isDualAxis && (
          <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
            domain={[0, 25]}
          />
        )}
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E4E8F0', 
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontSize: '12px'
          }} 
        />
        <Legend 
          verticalAlign="top" 
          align="right" 
          height={30}
          iconType="circle"
          wrapperStyle={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}
        />

        {/* METRIC 1 RENDERING */}
        {chartType === 'line' ? (
          <Line 
            yAxisId="left"
            name={label1} 
            dataKey="metric1" 
            stroke="#2563eb" 
            strokeWidth={2} 
            dot={{ r: 3, fill: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ) : (
          <Bar 
            yAxisId="left"
            name={label1} 
            dataKey="metric1" 
            fill="#2563eb" 
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
        )}

        {/* METRIC 2 RENDERING */}
        {chartType === 'hybrid' || chartType === 'line' ? (
          <Line 
            yAxisId={isDualAxis ? "right" : "left"}
            name={label2} 
            dataKey="metric2" 
            stroke="#10b981" 
            strokeWidth={2} 
            dot={{ r: 3, fill: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ) : (
          <Bar 
            yAxisId={isDualAxis ? "right" : "left"}
            name={label2} 
            dataKey="metric2" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]}
            barSize={20}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};
