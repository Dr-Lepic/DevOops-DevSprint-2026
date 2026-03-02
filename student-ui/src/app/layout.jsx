import './globals.css';

export const metadata = {
  title: 'IUT Cafeteria - DevSprint 2026',
  description: 'Student ordering system for IUT Cafeteria - DevSprint 2026 Hackathon Project',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
