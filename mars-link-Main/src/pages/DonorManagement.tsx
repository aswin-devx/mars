import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Heart, UserCheck, UserX, Clock, CheckCircle, AlertTriangle, Ban, Pause, Send, Activity } from "lucide-react";

interface Donor {
  id: string;
  name: string;
  bloodGroup: string;
  phone: string;
  lambdaScore: number;
  donationHistory: number;
  lastDonation: string;
  status: "available" | "postponed" | "substituted" | "donated" | "suspended" | "terminated";
  reason?: string;
  suspendedUntil?: string;
  clickedAt: string;
  requestId: string;
}

const DonorManagement = () => {
  const navigate = useNavigate();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BASE_URL || 'http://localhost:8081'}/hospital/donors`);
        const data = await response.json();
        if (data.donors) {
          setDonors(data.donors);
        }
      } catch (error) {
        console.error("Failed to fetch donors", error);
        toast({ title: "Error", description: "Failed to load donors", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDonors();
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem("marslink_auth");
    if (!auth) {
      navigate("/login");
    }
  }, [navigate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-green-100 text-green-800"><UserCheck className="h-3 w-3 mr-1" />Available</Badge>;
      case "postponed":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Postponed</Badge>;
      case "substituted":
        return <Badge className="bg-blue-100 text-blue-800"><AlertTriangle className="h-3 w-3 mr-1" />Substituted</Badge>;
      case "donated":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Donated</Badge>;
      case "suspended":
        return <Badge className="bg-orange-100 text-orange-800"><Pause className="h-3 w-3 mr-1" />Suspended</Badge>;
      case "terminated":
        return <Badge className="bg-red-100 text-red-800"><Ban className="h-3 w-3 mr-1" />Terminated</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getLambdaGrade = (score: number) => {
    if (score >= 85) return { grade: "Excellent", color: "bg-green-100 text-green-800 border-green-300", bar: "bg-green-600" };
    if (score >= 70) return { grade: "Good", color: "bg-blue-100 text-blue-800 border-blue-300", bar: "bg-blue-600" };
    if (score >= 50) return { grade: "Fair", color: "bg-yellow-100 text-yellow-800 border-yellow-300", bar: "bg-yellow-600" };
    if (score >= 30) return { grade: "At Risk", color: "bg-orange-100 text-orange-800 border-orange-300", bar: "bg-orange-600" };
    return { grade: "Critical", color: "bg-red-100 text-red-800 border-red-300", bar: "bg-red-600" };
  };

  const getLambdaScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const canTakeAction = (donor: Donor) => {
    return donor.lambdaScore < 70 || donor.donationHistory < 3;
  };

  const [suspendDialog, setSuspendDialog] = useState({ open: false, donorId: "", donorName: "" });
  const [suspendDays, setSuspendDays] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const handleSuspend = () => {
    const days = parseInt(suspendDays);
    if (!days || days <= 0) {
      toast({ title: "Invalid input", description: "Please enter valid number of days.", variant: "destructive" });
      return;
    }
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + days);
    
    setDonors(prev => prev.map(d => 
      d.id === suspendDialog.donorId ? { 
        ...d, 
        status: "suspended" as const, 
        reason: suspendReason || "Suspended",
        suspendedUntil: suspendedUntil.toISOString().split('T')[0]
      } : d
    ));
    toast({ title: "Donor suspended", description: `${suspendDialog.donorName} suspended for ${days} days.` });
    setSuspendDialog({ open: false, donorId: "", donorName: "" });
    setSuspendDays("");
    setSuspendReason("");
  };

  const handleTerminate = (donorId: string) => {
    setDonors(prev => prev.map(d => 
      d.id === donorId ? { ...d, status: "terminated" as const } : d
    ));
    toast({ title: "Donor terminated", description: "Donor has been terminated from the system." });
  };

  const handleNotifySuccess = (donorId: string) => {
    toast({ 
      title: "Notification sent", 
      description: "Success notification sent via MARS-Pulse app." 
    });
  };

  const availableDonors = donors.filter(d => ["available", "postponed", "substituted"].includes(d.status));
  const donatedDonors = donors.filter(d => d.status === "donated");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Donor Management</h1>
            <p className="text-muted-foreground mt-1">
              Track and manage donors who responded to donation requests
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{donors.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {donors.filter(d => d.status === "available").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {donatedDonors.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {donors.filter(d => ["postponed", "substituted"].includes(d.status)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Pending Donors</TabsTrigger>
            <TabsTrigger value="completed">Completed Donations</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Donors Who Clicked "I Can Donate"</CardTitle>
                <CardDescription>
                  Manage donors who responded to requests but haven't completed donation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {availableDonors.map((donor) => (
                    <Card key={donor.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold">{donor.name}</span>
                              {getStatusBadge(donor.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span><span className="font-medium text-foreground">Blood:</span> {donor.bloodGroup}</span>
                              <span><span className="font-medium text-foreground">Phone:</span> {donor.phone}</span>
                              <span><span className="font-medium text-foreground">Request:</span> {donor.requestId}</span>
                              <span><span className="font-medium text-foreground">Clicked:</span> {donor.clickedAt}</span>
                            </div>
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-muted-foreground" />
                                  <span className={`font-bold ${getLambdaScoreColor(donor.lambdaScore)}`}>
                                    λ-Score: {donor.lambdaScore}
                                  </span>
                                </div>
                                <Badge variant="outline" className={getLambdaGrade(donor.lambdaScore).color}>
                                  {getLambdaGrade(donor.lambdaScore).grade}
                                </Badge>
                              </div>
                              <Progress 
                                value={donor.lambdaScore} 
                                className="h-2"
                                indicatorClassName={getLambdaGrade(donor.lambdaScore).bar}
                              />
                            </div>
                            <div className="flex items-center gap-4 text-sm mt-2 md:mt-0">
                              <span className="text-muted-foreground">
                                Donations: {donor.donationHistory}
                              </span>
                              <span className="text-muted-foreground">
                                Last: {donor.lastDonation}
                              </span>
                            </div>
                            {(donor.reason || donor.suspendedUntil) && (
                              <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                                {donor.reason && <><span className="font-medium">Reason:</span> {donor.reason}</>}
                                {donor.suspendedUntil && <span className="ml-2">(Suspended until: {donor.suspendedUntil})</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {canTakeAction(donor) && donor.status !== "suspended" && (
                              <>
                                <Dialog open={suspendDialog.open && suspendDialog.donorId === donor.id} onOpenChange={(open) => !open && setSuspendDialog({ open: false, donorId: "", donorName: "" })}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setSuspendDialog({ open: true, donorId: donor.id, donorName: donor.name })}>
                                      <Pause className="h-4 w-4 mr-1" />
                                      Suspend
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Suspend Donor</DialogTitle>
                                      <DialogDescription>
                                        Suspend {donor.name} from receiving donation requests
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="days">Suspension Duration (days)</Label>
                                        <Input 
                                          id="days" 
                                          type="number" 
                                          placeholder="Enter number of days" 
                                          value={suspendDays}
                                          onChange={(e) => setSuspendDays(e.target.value)}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="reason">Reason</Label>
                                        <Select value={suspendReason} onValueChange={setSuspendReason}>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select reason" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Fever">Fever</SelectItem>
                                            <SelectItem value="Low hemoglobin">Low hemoglobin</SelectItem>
                                            <SelectItem value="High blood pressure">High blood pressure</SelectItem>
                                            <SelectItem value="Recent illness">Recent illness</SelectItem>
                                            <SelectItem value="Medication">On medication</SelectItem>
                                            <SelectItem value="Other medical condition">Other medical condition</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setSuspendDialog({ open: false, donorId: "", donorName: "" })}>Cancel</Button>
                                      <Button onClick={handleSuspend}>Suspend</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Ban className="h-4 w-4 mr-1" />
                                      Terminate
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Terminate Donor</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently remove {donor.name} from the system. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleTerminate(donor.id)}>
                                        Terminate
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Donations</CardTitle>
                <CardDescription>
                  Donors who have successfully completed their donations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {donatedDonors.map((donor) => (
                    <Card key={donor.id} className="border-2 border-green-200">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold">{donor.name}</span>
                              {getStatusBadge(donor.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span><span className="font-medium text-foreground">Blood:</span> {donor.bloodGroup}</span>
                              <span><span className="font-medium text-foreground">Phone:</span> {donor.phone}</span>
                              <span><span className="font-medium text-foreground">Request:</span> {donor.requestId}</span>
                              <span><span className="font-medium text-foreground">Donated:</span> {donor.clickedAt}</span>
                            </div>
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-muted-foreground" />
                                  <span className={`font-bold ${getLambdaScoreColor(donor.lambdaScore)}`}>
                                    λ-Score: {donor.lambdaScore}
                                  </span>
                                </div>
                                <Badge variant="outline" className={getLambdaGrade(donor.lambdaScore).color}>
                                  {getLambdaGrade(donor.lambdaScore).grade}
                                </Badge>
                              </div>
                              <Progress 
                                value={donor.lambdaScore} 
                                className="h-2"
                                indicatorClassName={getLambdaGrade(donor.lambdaScore).bar}
                              />
                            </div>
                            <div className="flex items-center gap-4 text-sm mt-2 md:mt-0">
                              <span className="text-muted-foreground">
                                Total Donations: {donor.donationHistory + 1}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleNotifySuccess(donor.id)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Notify Success
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DonorManagement;
