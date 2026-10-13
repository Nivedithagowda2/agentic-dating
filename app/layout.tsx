import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic Dating",
  description: "Every person gets an agent. The agents go on the dates. You get the ranking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <div className="wrap">
            <Link href="/" className="brand">
              agentic<b>·</b>dating
            </Link>
            <Link href="/" className="l">People</Link>
            <Link href="/rankings" className="l">Rankings</Link>
            <Link href="/about" className="l">How it works</Link>
            <span style={{ flex: 1 }} />
            <a href="/api/export" className="l" target="_blank">Export JSON</a>
          </div>
        </nav>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap">
            Only public LinkedIn and public Instagram data is read, only for people who consented (or public figures), and sensitive traits (health, religion, politics, orientation, ethnicity) are never inferred.
            Remove anyone any time from their profile page.
          </div>
        </footer>
      </body>
    </html>
  );
}
