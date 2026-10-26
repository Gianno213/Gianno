"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export function TrendChart({
  data,
  max = 5,
  currency = false,
}: {
  data: { label: string; value: number | null; count?: number }[];
  max?: number;
  currency?: boolean;
}) {
  return (
    <div
      style={{ width: "100%", height: 235, padding: "8px 20px 0" }}
      role="img"
      aria-label={
        currency
          ? "Andamento mensile delle retribuzioni nette"
          : "Andamento delle valutazioni medie mensili"
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 8, left: -18, bottom: 8 }}
        >
          <defs>
            <linearGradient
              id={currency ? "salaryFill" : "evaluationFill"}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#7e8b64" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#7e8b64" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#eeeee7"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#949b87" }}
            dy={8}
          />
          <YAxis
            domain={[0, currency ? "auto" : max]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#a1a68f" }}
          />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7dc",
                    padding: "10px 14px",
                    borderRadius: 7,
                    fontSize: 12,
                    boxShadow: "0 4px 12px #0001",
                  }}
                >
                  <strong>{label}</strong>
                  <p>
                    {currency
                      ? new Intl.NumberFormat("it-IT", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(payload[0].value))
                      : Number(payload[0].value).toFixed(2) + " / 5"}
                  </p>
                  {payload[0].payload.count != null && (
                    <small style={{ color: "#939a84" }}>
                      {payload[0].payload.count} mesi / valutazioni disponibili
                    </small>
                  )}
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#7e8b64"
            strokeWidth={2.5}
            fill={`url(#${currency ? "salaryFill" : "evaluationFill"})`}
            connectNulls={false}
            dot={{ r: 3, fill: "#fff", stroke: "#7e8b64", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
