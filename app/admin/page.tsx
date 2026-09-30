import AdminDashboard from '@/components/AdminDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin · API Keys · Curious AI',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
