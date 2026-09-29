import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Some browser extensions (e.g. Bitdefender's Online Threat Protection) stamp
 * every element with attributes like `bis_skin_checked="1"` before React
 * hydrates, which triggers hydration-mismatch console errors on every <div>.
 * This guard strips those extension attributes before hydration and keeps
 * watching for late injections. Purely cosmetic: it never touches real app
 * attributes, and a per-element cap prevents any observer ping-pong.
 */
const EXTENSION_ATTR_GUARD = `
(function () {
  try {
    var limits = new WeakMap();
    function isBad(name) {
      return name.indexOf("bis_") === 0 || name.indexOf("__processed_") === 0;
    }
    function clean(el) {
      if (!el || el.nodeType !== 1) return;
      var n = limits.get(el) || 0;
      if (n >= 5) return;
      var attrs = el.attributes;
      var removed = false;
      for (var i = attrs.length - 1; i >= 0; i--) {
        if (isBad(attrs[i].name)) {
          el.removeAttribute(attrs[i].name);
          removed = true;
        }
      }
      if (removed) limits.set(el, n + 1);
    }
    function sweep(root) {
      if (!root || root.nodeType !== 1) return;
      clean(root);
      var all = root.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) clean(all[i]);
    }
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "attributes") {
          if (isBad(m.attributeName || "")) clean(m.target);
        } else if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) sweep(m.addedNodes[j]);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    sweep(document.documentElement);
    document.addEventListener("DOMContentLoaded", function () {
      sweep(document.documentElement);
    });
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "PureDownload — Video Downloader, Zero Added Watermarks",
  description:
    "Fast, privacy-focused video downloader. Paste a link, pick a quality, and save videos or MP3s locally. We never add a watermark to your downloaded files.",
  keywords: ["video downloader", "no watermark", "mp3", "download manager", "offline"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <script dangerouslySetInnerHTML={{ __html: EXTENSION_ATTR_GUARD }} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
