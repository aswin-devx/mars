import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Droplet, Building2 } from "lucide-react";

// Access the API Base URL from the Vite environment variable directly.
// We must trust the Vite configuration will correctly inject this variable at build time.
const API_URL = import.meta.env.VITE_BASE_URL;

const Login = () => {
    const [hospitalId, setHospitalId] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!hospitalId || !password) {
            toast({ 
                title: "Validation Failed", 
                description: "Please enter both Hospital ID (Email) and Password." 
            });
            return;
        }
        
        setIsLoading(true);

        try {
            console.log(API_URL)
            // Construct the URL using the Vite environment variable for the base path
            const url = `${API_URL}/auth/login?email=${encodeURIComponent(hospitalId)}&password=${encodeURIComponent(password)}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            const data = await response.json();

            if (response.ok) {
                // --- SUCCESS ---
                
                // Determine hospital type for client-side logic
                // Check if hospital_type is explicitly returned, otherwise infer from name (as a fallback)
                // This logic is crucial for later functionality constraints in MARS Link (e.g., Inventory)
                const hospitalType = data.hospital_type || (data.hospital_name && data.hospital_name.toLowerCase().includes('govt') ? 'government' : 'private');
                
                // Save essential data
                localStorage.setItem("marslink_auth", "true");
                localStorage.setItem("userId", data.userId);
                localStorage.setItem("hospital_type", hospitalType);
                localStorage.setItem("user_name", data.name);
                
                toast({
                    title: "Login Successful",
                    description: `Welcome to MARS Link, ${data.name}.`,
                });
                
                navigate("/dashboard");

            } else {
                // --- FAILURE (API Error, e.g., 400 Bad Request) ---
                toast({
                    title: "Login Failed",
                    description: data.message || "Invalid credentials. Please check your Hospital ID and Password.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            // --- FAILURE (Network/Server Error) ---
            console.error("Login API Error:", error);
            toast({
                title: "Network Error",
                description: "Could not connect to the MARS server. Ensure the backend is running and accessible.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden">
                <CardHeader className="space-y-4 text-center pb-8 bg-red-700 text-white">
                    <div className="flex justify-center mb-2">
                        <div className="relative">
                            {/* MARS Link Icon: Droplet (Blood) + Building (Hospital) */}
                            <Droplet className="h-16 w-16 text-white" fill="currentColor" />
                            <Building2 className="h-6 w-6 text-yellow-300 absolute -right-1 -bottom-1 p-0.5 bg-red-800 rounded-full" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-extrabold">MARS Link</CardTitle>
                    <CardDescription className="text-base text-gray-200">
                        Hospital Resource Management Portal
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="hospitalId" className="font-semibold text-gray-700">
                                Hospital ID (Email)
                            </Label>
                            <Input
                                id="hospitalId"
                                placeholder="e.g., arun@link.com"
                                type="email"
                                value={hospitalId}
                                onChange={(e) => setHospitalId(e.target.value)}
                                required
                                className="h-12 border-gray-300 focus:border-red-500"
                            />
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="password" className="font-semibold text-gray-700">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12 border-gray-300 focus:border-red-500"
                            />
                        </div>
                        <Button 
                            type="submit" 
                            className="w-full font-bold py-3 text-lg h-12 bg-red-700 hover:bg-red-800 transition duration-200 shadow-md" 
                            size="lg" 
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Authenticating...
                                </>
                            ) : "Sign In to Portal"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;