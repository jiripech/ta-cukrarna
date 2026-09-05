import type { Metadata } from 'next';

// Applies to /admin/ and /admin/register/ - overrides the root layout title
// so the browser tab identifies the admin area.
export const metadata: Metadata = {
  title: 'Administrace otevírací doby | Ta Cukrárna',
  description: 'Správa otevírací doby cukrárny Ta Cukrárna.',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
