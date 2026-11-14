import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Droplets, Edit, Save, AlertTriangle } from "lucide-react";

interface BloodGroup {
  group: string;
  available: number;
  reserved: number;
  immediate: number;
}

const Inventory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [inventory, setInventory] = useState<BloodGroup[]>([
    { group: "A+", available: 45, reserved: 8, immediate: 7 },
    { group: "A-", available: 12, reserved: 3, immediate: 5 },
    { group: "B+", available: 38, reserved: 5, immediate: 7 },
    { group: "B-", available: 8, reserved: 2, immediate: 10 },
    { group: "O+", available: 52, reserved: 10, immediate: 8 },
    { group: "O-", available: 5, reserved: 2, immediate: 8 },
    { group: "AB+", available: 15, reserved: 4, immediate: 6 },
    { group: "AB-", available: 3, reserved: 1, immediate: 6 },
    { group: "hh", available: 5, reserved: 2, immediate: 8 },
  ]);

  // Bank-level general capacity (single value). Init to previous sum of group capacities (60+20+50+20+70+15+25+10+15 = 285)
  const [generalCapacity, setGeneralCapacity] = useState<number>(285);

  useEffect(() => {
    const auth = localStorage.getItem("marslink_auth");
    if (!auth) {
      navigate("/login");
    }
  }, [navigate]);

  const handleSave = () => {
    toast({
      title: "Inventory Updated",
      description: "Blood inventory has been successfully updated.",
    });
    setEditMode(false);
  };

  const handleUpdateField = (
    group: string,
    field: keyof BloodGroup,
    value: number
  ) => {
    // Ensure stored values are non-negative integers
    const safeVal = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setInventory((prev) =>
      prev.map((item) =>
        item.group === group ? { ...item, [field]: safeVal } : item
      )
    );
  };

  // Update general capacity while ensuring it's a non-negative integer
  const handleUpdateGeneralCapacity = (value: number) => {
    const safeVal = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    setGeneralCapacity(safeVal);
  };

  // compute average per-group capacity (avoid division by zero)
  const avgGroupCapacity =
    generalCapacity > 0 && inventory.length > 0
      ? generalCapacity / inventory.length
      : 1;

  // Updated badge logic: compare group available to avg group capacity
  const getStatusBadge = (available: number) => {
    const safeAvg = avgGroupCapacity > 0 ? avgGroupCapacity : 1;
    const percentage = (available / safeAvg) * 100;
    if (percentage < 30) {
      return <Badge variant="destructive">Critical</Badge>;
    } else if (percentage < 50) {
      return <Badge className="bg-warning text-warning-foreground">Low</Badge>;
    } else {
      return <Badge className="bg-success text-success-foreground">Adequate</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Blood Inventory Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your blood bank capacity and availability
            </p>
          </div>
          <Button
            onClick={editMode ? handleSave : () => setEditMode(true)}
            variant={editMode ? "default" : "outline"}
          >
            {editMode ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Inventory
              </>
            )}
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Capacity
              </CardTitle>
              <Droplets className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {generalCapacity}
              </div>
              <p className="text-xs text-muted-foreground mt-1">units</p>

              {/* General bank-level capacity input (editable only in editMode) */}
              <div className="mt-3">
                <Label htmlFor="general-capacity">Bank Capacity (general)</Label>
                <Input
                  id="general-capacity"
                  type="number"
                  min={0}
                  value={generalCapacity}
                  disabled={!editMode}
                  onChange={(e) =>
                    handleUpdateGeneralCapacity(Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">Overall bank capacity (not per blood group)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Available Units
              </CardTitle>
              <Droplets className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inventory.reduce((sum, item) => sum + item.available, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">units</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Immediate Needs
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-urgent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-urgent">
                {inventory.reduce((sum, item) => sum + item.immediate, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">units required</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Blood Group Inventory</CardTitle>
            <CardDescription>
              Detailed breakdown of blood units by group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {inventory.map((item) => (
                <Card key={item.group} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <span className="text-lg font-bold text-primary">
                            {item.group}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            Blood Group {item.group}
                          </CardTitle>
                          <CardDescription>
                            {((avgGroupCapacity > 0 ? (item.available / avgGroupCapacity) : 0) * 100).toFixed(0)}
                            % capacity
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(item.available)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Capacity input removed (we have generalCapacity instead) */}
                      <div className="space-y-2">
                        <Label htmlFor={`available-${item.group}`}>
                          Available
                        </Label>
                        <Input
                          id={`available-${item.group}`}
                          type="number"
                          min={0}
                          value={item.available}
                          disabled={!editMode}
                          onChange={(e) =>
                            handleUpdateField(
                              item.group,
                              "available",
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`reserved-${item.group}`}>
                          Reserved
                        </Label>
                        <Input
                          id={`reserved-${item.group}`}
                          type="number"
                          min={0}
                          value={item.reserved}
                          disabled={!editMode}
                          onChange={(e) =>
                            handleUpdateField(
                              item.group,
                              "reserved",
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`immediate-${item.group}`}>
                          Immediate Need
                        </Label>
                        <Input
                          id={`immediate-${item.group}`}
                          type="number"
                          min={0}
                          value={item.immediate}
                          disabled={!editMode}
                          onChange={(e) =>
                            handleUpdateField(
                              item.group,
                              "immediate",
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
