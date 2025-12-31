import DashboardLayoutComponent from '@/components/DashboardLayout';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayoutComponent>
            {children}
        </DashboardLayoutComponent>
    );
}
