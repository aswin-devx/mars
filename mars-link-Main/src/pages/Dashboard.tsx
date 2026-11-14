import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Droplets,
  AlertCircle,
  TrendingUp,
  Activity,
  LogOut,
  Plus,
  ClipboardList,
  Building2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const Dashboard = () => {
  const navigate = useNavigate();
  const [hospitalType, setHospitalType] = useState<string>("private");

  useEffect(() => {
    const auth = localStorage.getItem("marslink_auth");
    if (!auth) {
      navigate("/login");
      return;
    }
    const type = localStorage.getItem("hospital_type") || "private";
    setHospitalType(type);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("marslink_auth");
    localStorage.removeItem("hospital_type");
    navigate("/login");
  };

  const inventoryData = [
    { group: "A+", available: 45, capacity: 60, percentage: 75 },
    { group: "A-", available: 12, capacity: 20, percentage: 60 },
    { group: "B+", available: 38, capacity: 50, percentage: 76 },
    { group: "B-", available: 8, capacity: 20, percentage: 40 },
    { group: "O+", available: 52, capacity: 70, percentage: 74 },
    { group: "O-", available: 5, capacity: 15, percentage: 33 },
    { group: "AB+", available: 15, capacity: 25, percentage: 60 },
    { group: "AB-", available: 3, capacity: 10, percentage: 30 },
    { group: "hh", available: 3, capacity: 10, percentage: 30 }
  ];

  const stats = [
    {
      title: "Total Capacity",
      value: "270",
      subtitle: "units",
      icon: Droplets,
      trend: "+5% from last month",
    },
    {
      title: "Available Units",
      value: "178",
      subtitle: "units",
      icon: Activity,
      trend: "66% capacity",
    },
    {
      title: "Active Requests",
      value: "7",
      subtitle: "pending",
      icon: AlertCircle,
      trend: "3 urgent",
    },
    {
      title: "Monthly Usage",
      value: "142",
      subtitle: "units",
      icon: TrendingUp,
      trend: "+12% vs last month",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back to MARS Link Portal
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm py-2 px-4 border-primary text-primary">
              <Building2 className="h-4 w-4 mr-2" />
              {hospitalType === "government" ? "Government Hospital" : "Private Hospital"}
            </Badge>
            <Button variant="outline" onClick={handleLogout} className="border-primary text-primary hover:bg-primary hover:text-white">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.subtitle}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {stat.trend}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and operations
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button 
              onClick={() => navigate("/inventory")}
            >
              <Droplets className="h-4 w-4 mr-2" />
              Manage Inventory
            </Button>
            <Button 
              onClick={() => navigate("/requests/new")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Request
            </Button>
            <Button 
              onClick={() => navigate("/requests")} 
              variant="outline"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              View Requests
            </Button>
          </CardContent>
        </Card>

        {/* Blood Inventory Overview */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Blood Inventory Overview</CardTitle>
            <CardDescription>
              Current stock levels across all blood groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventoryData.map((item) => (
                <div key={item.group} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Blood Group {item.group}
                    </span>
                    <span className="text-muted-foreground">
                      {item.available}/{item.capacity} units
                    </span>
                  </div>
                  <Progress
                    value={item.percentage}
                    className="h-2"
                  />
                  {item.percentage < 40 && (
                    <p className="text-xs text-destructive font-medium">
                      Low stock - Consider requesting
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
