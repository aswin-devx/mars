import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Droplet, Heart, Shield, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Droplet className="h-24 w-24 text-primary" fill="currentColor" />
                <Heart className="h-10 w-10 text-urgent absolute -right-2 -bottom-2" fill="currentColor" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              MARS Link
            </h1>
            <p className="text-2xl text-muted-foreground">
              Mobile Automated Repository for Saving Lives
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hospital Resource Management Portal - Real-time blood inventory
              management and geo-prioritized request system
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-lg border bg-card">
              <Droplet className="h-10 w-10 text-primary mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">
                Inventory Management
              </h3>
              <p className="text-sm text-muted-foreground">
                Real-time tracking of blood capacity and availability
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <Zap className="h-10 w-10 text-warning mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">GPRS System</h3>
              <p className="text-sm text-muted-foreground">
                3-tier geo-prioritized request matching (15/37/120 km)
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <Shield className="h-10 w-10 text-success mb-4 mx-auto" />
              <h3 className="font-semibold text-lg mb-2">
                Secure & Reliable
              </h3>
              <p className="text-sm text-muted-foreground">
                Government-grade security and compliance
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 space-y-4">
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              onClick={() => navigate("/login")}
            >
              Access Hospital Portal
            </Button>
            <p className="text-sm text-muted-foreground">
              Authorized hospital personnel only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
