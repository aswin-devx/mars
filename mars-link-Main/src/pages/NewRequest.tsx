import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Info } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Access the API Base URL from the Vite environment variable
const API_URL = import.meta.env.VITE_BASE_URL;

const NewRequest = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [bloodGroup, setBloodGroup] = useState("");
    const [units, setUnits] = useState("");
    const [urgency, setUrgency] = useState("routine");
    const [tier, setTier] = useState("1");
    const [notes, setNotes] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Fix: Check for the token saved during login
        const token = localStorage.getItem("marslink_auth"); 
        if (!token) {
            navigate("/login");
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const unitsRequired = parseInt(units, 10);
        const hospital_id = localStorage.getItem("userId")


        if (!bloodGroup || unitsRequired <= 0 || isNaN(unitsRequired)) {
            toast({
                title: "Validation Error",
                description: "Please select a blood group and enter a valid number of units.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        // --- Urgency Mapping (Frontend to Backend) ---
        // Backend expects: normal | urgent | critical
        const urgencyMap: { [key: string]: string } = {
            "routine": "normal",
            "urgent": "urgent",
            "emergency": "critical",
        };
        const backendUrgency = urgencyMap[urgency] || "normal";

        const payload = {
            hospital_id,
            blood_group: bloodGroup,
            units_required: unitsRequired,
            urgency: backendUrgency,
            // Notes are not sent as per the simplified backend model for this endpoint
        };

        try {
            const url = `${API_URL}/hospital/request`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "Request Submitted",
                    description: data.message || `Request ID ${data.requestId} created successfully. Matching in progress...`,
                });
                navigate("/requests");
            } else {
                // Handle API error messages from the Node.js backend (e.g., Joi validation failure)
                const errorDescription = Array.isArray(data.errors) ? data.errors.map((err: { message: string }) => err.message).join('; ') : data.message || "An unknown error occurred on the server.";
                toast({
                    title: "Submission Failed",
                    description: errorDescription,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Request API Error:", error);
            toast({
                title: "Network Error",
                description: "Could not connect to the MARS backend API. Please check server status.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const getTierInfo = (tierValue: string) => {
        // Note: The tier logic is still purely for frontend display as per the request
        switch (tierValue) {
            case "1":
                return {
                    label: "Basic (Tier 1)",
                    radius: "15 km",
                    description: "Local blood bank, nearby donors, same city",
                    color: "text-green-600", // Use Tailwind colors for visual consistency
                };
            case "2":
                return {
                    label: "Advanced (Tier 2)",
                    radius: "37 km",
                    description: "Regional supply pool, neighbouring districts",
                    color: "text-yellow-600",
                };
            case "3":
                return {
                    label: "Emergency (Tier 3)",
                    radius: "120 km",
                    description: "State-wide mobilization",
                    color: "text-red-600",
                };
            default:
                return {
                    label: "",
                    radius: "",
                    description: "",
                    color: "",
                };
        }
    };

    const tierInfo = getTierInfo(tier);

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-red-700">
                        Create Blood Request
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Submit a request via the Geo-Prioritized Request System (GPRS)
                    </p>
                </div>

                {/* GPRS Info Card */}
                <Card className="border-red-700/20 bg-red-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <Info className="h-5 w-5" />
                            About GPRS Tiers (Rarity Radius Model)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-gray-700">
                        <p>
                            <strong>Tier 1 (Basic):</strong> Up to 15 km radius - Local blood
                            bank, nearby donors
                        </p>
                        <p>
                            <strong>Tier 2 (Advanced):</strong> Up to 37 km radius - Regional
                            supply pool
                        </p>
                        <p>
                            <strong>Tier 3 (Emergency):</strong> Up to 120 km radius -
                            State-wide mobilization
                        </p>
                    </CardContent>
                </Card>

                {/* Request Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Request Details</CardTitle>
                        <CardDescription>
                            Fill in the details of your blood requirement
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Blood Group */}
                            <div className="space-y-2">
                                <Label htmlFor="bloodGroup">
                                    Blood Group <span className="text-destructive">*</span>
                                </Label>
                                <Select value={bloodGroup} onValueChange={setBloodGroup} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select blood group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A+">A+</SelectItem>
                                        <SelectItem value="A-">A-</SelectItem>
                                        <SelectItem value="B+">B+</SelectItem>
                                        <SelectItem value="B-">B-</SelectItem>
                                        <SelectItem value="O+">O+</SelectItem>
                                        <SelectItem value="O-">O-</SelectItem>
                                        <SelectItem value="AB+">AB+</SelectItem>
                                        <SelectItem value="AB-">AB-</SelectItem>
                                        <SelectItem value="hh">hh (Bombay Blood Group)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Units Required */}
                            <div className="space-y-2">
                                <Label htmlFor="units">
                                    Units Required <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="units"
                                    type="number"
                                    min="1"
                                    placeholder="Enter number of units"
                                    value={units}
                                    onChange={(e) => setUnits(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Urgency Level */}
                            <div className="space-y-3">
                                <Label>Urgency Level (Maps to Backend: normal | urgent | critical)</Label>
                                <RadioGroup value={urgency} onValueChange={setUrgency}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="routine" id="routine" />
                                        <Label htmlFor="routine" className="font-normal cursor-pointer">
                                            Routine - Standard request (Backend: `normal`)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="urgent" id="urgent" />
                                        <Label htmlFor="urgent" className="font-normal cursor-pointer">
                                            Urgent - Required within 24 hours (Backend: `urgent`)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="emergency" id="emergency" />
                                        <Label htmlFor="emergency" className="font-normal cursor-pointer text-red-600 font-semibold">
                                            Emergency - Critical situation (Backend: `critical`)
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* GPRS Tier Display (Read-Only/Informational) */}
                            <div className="space-y-3">
                                <Label>GPRS Tier (Search Radius - Automatic selection based on Urgency/Rarity)</Label>
                                <RadioGroup value={tier} onValueChange={setTier} disabled={true}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="1" id="tier1" />
                                        <Label htmlFor="tier1" className="font-normal">Tier 1 - Basic (15 km)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="2" id="tier2" />
                                        <Label htmlFor="tier2" className="font-normal">Tier 2 - Advanced (37 km)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="3" id="tier3" />
                                        <Label htmlFor="tier3" className="font-normal">Tier 3 - Emergency (120 km)</Label>
                                    </div>
                                </RadioGroup>
                                {tier && (
                                    <Card className="border-dashed">
                                        <CardContent className="pt-4">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className={`h-5 w-5 mt-0.5 ${tierInfo.color}`} />
                                                <div className="space-y-1">
                                                    <p className={`font-semibold ${tierInfo.color}`}>
                                                        {tierInfo.label}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Search radius: {tierInfo.radius}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {tierInfo.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Additional Notes */}
                            <div className="space-y-2">
                                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Any additional information about this request..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Button 
                                    type="submit" 
                                    className="flex-1 bg-red-700 hover:bg-red-800"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Submitting...' : 'Submit Request'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate("/requests")}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default NewRequest;
