import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Droplets,
  ClipboardList,
  Plus,
  Heart,
  FileText,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Inventory", url: "/inventory", icon: Droplets },
  { title: "Requests", url: "/requests", icon: ClipboardList },
  { title: "New Request", url: "/requests/new", icon: Plus },
  { title: "Donors", url: "/donors", icon: Heart },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      collapsible="icon"
      className="bg-primary/5 border-r border-primary/20 shadow-sm"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary font-semibold text-xs uppercase tracking-wider px-3">
            Main Menu
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 
                         transition-colors duration-200 
                         mx-2 rounded-md px-3 py-2
                         ${isActive ? 'bg-white text-primary font-medium shadow-sm' : 'text-primary hover:bg-primary/10 hover:text-primary'}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon 
                            className="h-4 w-4 transition-colors duration-200" 
                          />
                          {open && <span>{item.title}</span>}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
