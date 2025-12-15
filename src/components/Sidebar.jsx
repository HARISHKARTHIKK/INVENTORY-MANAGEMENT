import { LayoutDashboard, Package, ClipboardList, FileText, Users, BarChart3, Settings, Truck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Inventory / Product', href: '/inventory', icon: ClipboardList },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Dispatch', href: '/dispatch', icon: Truck },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
];

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Sidebar() {
    const { settings } = useSettings();
    const { userRole } = useAuth();

    const filteredNav = navigation.filter(item => {
        if (item.name === 'Dispatch') {
            return settings?.transport?.enable !== false;
        }
        if (item.name === 'Settings' || item.name === 'Users') {
            return userRole === 'admin';
        }
        return true;
    });

    return (
        <div className="flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-screen fixed left-0 top-0 text-white shadow-xl z-20">
            <div className="flex h-16 items-center pl-6 border-b border-slate-800 bg-slate-900">
                <h1 className="text-xl font-bold tracking-wider text-blue-400">MAB<span className="text-white"> CHEM</span></h1>
            </div>
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                {filteredNav.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                            cn(
                                'group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            )
                        }
                    >
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110" />
                        {item.name}
                    </NavLink>
                ))}
            </nav>
            <div className="border-t border-slate-800 p-4 bg-slate-900">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 ring-1 ring-blue-500/50">
                        <Settings className="h-4 w-4" />
                    </div>
                    <div className="text-xs text-slate-400">
                        <p className="font-medium text-white">System Status</p>
                        <p className="text-green-500">● Online</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
