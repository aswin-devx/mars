// src/pages/Reports.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, Activity, Droplet, TrendingUp } from "lucide-react";

/**
 * Reports page — uses shared DashboardLayout (so sidebar is handled globally like NewRequest)
 * Bars are rendered with CSS and a fixed chart height so percentage heights work reliably.
 */

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("marslink_auth");
    if (!auth) navigate("/login");
  }, [navigate]);

  const chartData = useMemo(
    () => ({
      weekly: [
        { label: "Mon", value: 45 },
        { label: "Tue", value: 72 },
        { label: "Wed", value: 38 },
        { label: "Thu", value: 91 },
        { label: "Fri", value: 55 },
        { label: "Sat", value: 30 },
        { label: "Sun", value: 62 },
      ],
      monthly: [
        { label: "Week 1", value: 320 },
        { label: "Week 2", value: 450 },
        { label: "Week 3", value: 380 },
        { label: "Week 4", value: 510 },
      ],
      yearly: [
        { label: "Q1", value: 1200 },
        { label: "Q2", value: 1450 },
        { label: "Q3", value: 1100 },
        { label: "Q4", value: 1600 },
      ],
    }),
    []
  );

  const currentData = chartData[timeRange];
  const maxValue = Math.max(...currentData.map((d) => d.value));

  const handleTimeChange = (range: "weekly" | "monthly" | "yearly") => {
    setIsAnimating(true);
    setTimeRange(range);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleDownload = () => {
    // Hook this to html-to-image/html2canvas if you want PNG export.
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              Analytics Infographic
            </h1>
            <p className="text-muted-foreground mt-1">Visualizing blood supply and demand trends.</p>
          </div>

          <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
            {(["weekly", "monthly", "yearly"] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleTimeChange(r)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  timeRange === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>


        {/* Grid: left stats + right chart */}
        <div id="infographic-container" className="grid gap-6 md:grid-cols-12 items-start">
          {/* Left column (stats) */}
          <div className="md:col-span-4 space-y-4">
            <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/10 rounded-full opacity-50 blur-2xl" />
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Droplet className="h-5 w-5" /> Total Units
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {currentData.reduce((a, b) => a + b.value, 0).toLocaleString()}
                </div>
                <p className="text-sm text-primary mt-1 font-medium flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12% vs previous {timeRange}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-success/10 to-card border-success/20">
              <CardHeader>
                <CardTitle className="text-success flex items-center gap-2">
                  <Activity className="h-5 w-5" /> Fulfillment Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">94.2%</div>
                <p className="text-sm text-success mt-1 font-medium">Average response time: 45m</p>
              </CardContent>
            </Card>

            <div className="bg-primary rounded-xl p-6 text-primary-foreground shadow-lg">
              <h3 className="text-lg font-semibold mb-2">Insight</h3>
              <p className="text-primary-foreground/90 text-sm leading-relaxed">
                Blood type <span className="font-bold">O+</span> and{" "}
                <span className="font-bold">A+</span> show the highest turnover this {timeRange}. Consider
                increasing donor drives for these specific groups to maintain optimal buffer stock.
              </p>
            </div>
          </div>

          {/* Right column (bar chart built with CSS) */}
          <div className="md:col-span-8">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Supply Trends</CardTitle>
                <CardDescription>Visual distribution of inventory movements over the selected period.</CardDescription>
              </CardHeader>

              {/* Chart area: fixed height so percentage heights work */}
              <CardContent className="flex-1 min-h-[320px] flex items-end gap-4 pb-4 px-2 sm:px-8">
                <div className="w-full h-[300px] flex items-end gap-6 px-4">
                  {currentData.map((item, idx) => {
  const heightPct = Math.max((item.value / maxValue) * 100, 6);
  return (
    <div key={idx} className="flex flex-col items-center justify-end w-[64px] h-full">
      {/* value label (tooltip on hover) */}
      <div className="mb-2 text-xs font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {item.value}
      </div>

      {/* Bar */}
      <div
        className={`w-full rounded-t-md bg-primary hover:bg-secondary transition-all duration-500 ease-out transform ${
          isAnimating ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{
          height: `${heightPct}%`,
          transitionDelay: `${idx * 40}ms`,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary-foreground/10 to-transparent pointer-events-none rounded-t-md" />
      </div>

      {/* X-Axis Label */}
      <div className="mt-3 text-xs font-medium text-muted-foreground text-center truncate w-full">
        {item.label}
      </div>
    </div>
  );
})}

                </div>
              </CardContent>

              <div className="border-t p-4 bg-muted/50 rounded-b-xl flex justify-between items-center text-xs text-muted-foreground px-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Standard Supply</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span>Critical Demand</span>
                  </div>
                </div>
                <div>Updated: Just now</div>
              </div>
            </Card>

            {/* Download action */}
            <div className="mt-6 flex justify-end">
              <Button onClick={handleDownload} size="lg">
                <ArrowDownToLine className="h-5 w-5 mr-2" />
                Download {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
