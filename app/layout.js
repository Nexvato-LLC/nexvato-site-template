import { SITE_URL } from "../lib/shop";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Your Store",
  description: "Powered by Nexvato.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b1120",
          color: "#e2e8f0",
        }}
      >
        {children}
      </body>
    </html>
  );
}
