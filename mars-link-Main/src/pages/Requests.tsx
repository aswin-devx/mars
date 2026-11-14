import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, Info, HeartPulse } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const API_URL = import.meta.env.VITE_BASE_URL;


// --- Backend Interface Mapping ---
interface BackendRequest {
    _id: string;
    hospital_id: string;
    blood_group: string;
    units_required: number;
    urgency: "normal" | "urgent" | "critical";
    tier_used: string; // e.g., "tier1"
    status: "pending" | "matched" | "completed" | "cancelled"; // Using backend status names
    created_at: string;
}

// --- Frontend Interface ---
interface Request {
    id: string;
    bloodGroup: string;
    units: number;
    urgency: "routine" | "urgent" | "emergency"; // Frontend mapping
    tier: 1 | 2 | 3;
    status: "pending" | "processing" | "fulfilled" | "rejected" | "cancelled" | "matched" | "completed"; // Combined status list
    createdAt: string;
    radius: string; // Derived for display
}


const Requests = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [requests, setRequests] = useState<Request[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Helper function to map backend status to simple frontend display
    const mapBackendStatus = (status: string): Request['status'] => {
        if (status === "completed") return "fulfilled";
        if (status === "matched" || status === "pending") return "processing";
        if (status === "cancelled") return "rejected";
        return status as Request['status'];
    };
    
    // Helper function to map backend urgency to frontend display
    const mapBackendUrgency = (urgency: string): Request['urgency'] => {
        if (urgency === "critical") return "emergency";
        if (urgency === "normal") return "routine";
        return "urgent"; // 'urgent' maps directly
    };

    // Helper function to map tier/radius (for display only, as the backend calculates it)
    const getTierDetails = (tierUsed: string) => {
        switch (tierUsed) {
            case "tier3":
                return { tier: 3, radius: "120 km+", color: "text-red-600", label: "Emergency" };
            case "tier2":
                return { tier: 2, radius: "37 km", color: "text-yellow-600", label: "Advanced" };
            default:
                return { tier: 1, radius: "15 km", color: "text-green-600", label: "Basic" };
        }
    };


    const fetchActiveRequests = useCallback(async () => {
        // NOTE: Auth token saved during A5: Login Hospital Admin
        const token = localStorage.getItem("marslink_auth");
        const hospital_id = localStorage.getItem("userId")

        if (!token) {
            navigate("/login");
            return;
        }

        setIsLoading(true);

        try {
            // Endpoint: GET /hospital/dashboard
            const url = `${API_URL}/hospital/dashboard?hospital_id=${hospital_id}`;

            const response = await fetch(url, {
                method: 'GET',
            });

            const data = await response.json();
            console.log(data)

            if (response.ok && data.activeRequests) {
                const mappedRequests: Request[] = data.activeRequests.map((req: BackendRequest) => {
                    const tierInfo = getTierDetails(req.tier_used);
                    return {
                        id: req._id.substring(0, 8), // Shorten ID for display
                        bloodGroup: req.blood_group,
                        units: req.units_required,
                        urgency: mapBackendUrgency(req.urgency),
                        tier: tierInfo.tier,
                        status: mapBackendStatus(req.status),
                        // Convert ISO date string to locale string for user display
                        createdAt: new Date(req.created_at).toLocaleString(),
                        radius: tierInfo.radius,
                    };
                });
                setRequests(mappedRequests);
            } else {
                 toast({
                    title: "Data Fetch Failed",
                    description: data.message || "Could not load active requests from the dashboard.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Dashboard API Error:", error);
            toast({
                title: "Network Error",
                description: "Cannot connect to the MARS server to fetch requests.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [navigate, toast]);

    useEffect(() => {
        fetchActiveRequests();
    }, [fetchActiveRequests]);


    const getUrgencyBadge = (urgency: Request['urgency']) => {
        switch (urgency) {
            case "emergency":
                return <Badge className="bg-red-600 hover:bg-red-700 text-white">Emergency</Badge>;
            case "urgent":
                return <Badge className="bg-yellow-600 hover:bg-yellow-700 text-black">Urgent</Badge>;
            default:
                return <Badge variant="secondary">Routine</Badge>;
        }
    };

    const getStatusBadge = (status: Request['status']) => {
        switch (status) {
            case "fulfilled":
            case "completed":
                return (
                    <Badge className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Fulfilled
                    </Badge>
                );
            case "pending":
            case "processing":
            case "matched":
                return (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Clock className="h-3 w-3 mr-1" />
                        {status === 'pending' ? 'Pending Match' : 'Processing'}
                    </Badge>
                );
            case "rejected":
            case "cancelled":
                return (
                    <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelled
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unknown
                    </Badge>
                );
        }
    };

    const getTierInfo = (tier: number) => {
        // Re-use logic from getTierDetails for color/label
        if (tier === 3) return { label: "Emergency", color: "text-red-600" };
        if (tier === 2) return { label: "Advanced", color: "text-yellow-600" };
        return { label: "Basic", color: "text-green-600" };
    };
    
    if (isLoading) {
        return (
             <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <HeartPulse className="h-10 w-10 animate-pulse text-red-600" />
                    <p className="mt-4 text-lg font-semibold">Loading Active Requests...</p>
                    <p className="text-sm">Fetching data via GPRS from MARS Backend.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-red-700">Blood Requests</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage and track all blood requests via GPRS
                        </p>
                    </div>
                    <Button 
                        onClick={() => navigate("/requests/new")} 
                        className="bg-red-700 hover:bg-red-800"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Request
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Active Requests</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{requests.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending/Processing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {requests.filter((r) => r.status === "pending" || r.status === "processing").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Fulfilled (Completed)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {requests.filter((r) => r.status === "fulfilled" || r.status === "completed").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Critical Requests</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {requests.filter((r) => r.urgency === "emergency").length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Requests List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Active Requests</CardTitle>
                        <CardDescription>
                            All blood requests submitted through the Geo-Prioritized Request System
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {requests.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Info className="h-8 w-8 mx-auto mb-2" />
                                    No active requests found.
                                </div>
                            ) : (
                                requests.map((request) => {
                                    const tierInfo = getTierInfo(request.tier);
                                    return (
                                        <Card key={request.id} className="border-l-4 border-red-700/50">
                                            <CardContent className="pt-6">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="text-lg font-bold text-red-700">
                                                                {request.id}
                                                            </span>
                                                            {getStatusBadge(request.status)}
                                                            {getUrgencyBadge(request.urgency)}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium text-foreground">
                                                                    Blood Group:
                                                                </span>
                                                                <Badge className="bg-red-500 text-white font-bold text-base">
                                                                    {request.bloodGroup}
                                                                </Badge>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium text-foreground">
                                                                    Units:
                                                                </span>
                                                                {request.units}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="font-medium text-foreground">
                                                                    Created:
                                                                </span>
                                                                {request.createdAt}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className={`font-semibold ${tierInfo.color}`}>
                                                                Tier {request.tier} - {tierInfo.label}
                                                            </Badge>
                                                            <span className="text-sm text-muted-foreground">
                                                                Search radius: {request.radius}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm">
                                                            View Matches
                                                        </Button>
                                                        {(request.status === "pending" || request.status === "processing") && (
                                                            <Button variant="destructive" size="sm">
                                                                Cancel Request
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default Requests;
