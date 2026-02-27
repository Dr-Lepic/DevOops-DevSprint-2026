import './globals.css';

export const metadata = {
  title: 'DevSprint 2026 Student UI',
  description: 'Day 1 login flow',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
