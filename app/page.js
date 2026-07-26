import { getProducts, formatPrice, SHOP_ID, SHOP_API } from "../lib/shop";

// Server component: the catalog is fetched during the build/render on the
// server, so the shop id never has to round-trip through the browser and the
// page is indexable with real product content in the HTML.
export default async function Home() {
  let products = [];
  let error = null;
  try {
    products = await getProducts();
  } catch (e) {
    error = e.message;
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>Your Store</h1>
        <p style={{ color: "#94a3b8", marginTop: 8 }}>
          This site is connected to your Nexvato store. Products, pricing and
          stock are managed from your dashboard — no code changes needed.
        </p>
      </header>

      {/* Provisioning check. If the platform wired this repo correctly the
          banner below is green; if an env var is missing it says exactly
          which one, instead of silently rendering an empty shop. */}
      <section
        style={{
          border: `1px solid ${error ? "#7f1d1d" : "#14532d"}`,
          background: error ? "#450a0a" : "#052e16",
          borderRadius: 12,
          padding: 16,
          marginBottom: 32,
          fontSize: 14,
        }}
      >
        <strong>{error ? "Not connected" : "Connected"}</strong>
        <div style={{ color: "#94a3b8", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>
          <div>NEXT_PUBLIC_SHOP_ID: {SHOP_ID || "(missing)"}</div>
          <div>NEXT_PUBLIC_SHOP_API_URL: {SHOP_API}</div>
        </div>
        {error && <div style={{ marginTop: 8, color: "#fca5a5" }}>{error}</div>}
      </section>

      {products.length === 0 && !error && (
        <p style={{ color: "#94a3b8" }}>
          No products yet — add your first one from the dashboard.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {products.map((p) => {
          const price = p.variants?.[0]?.priceCents ?? 0;
          return (
            <article
              key={p.id}
              style={{
                border: "1px solid #1e293b",
                borderRadius: 12,
                padding: 16,
                background: "#0f172a",
              }}
            >
              <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>{p.name}</h2>
              <div style={{ color: "#a5b4fc", fontWeight: 600 }}>{formatPrice(price)}</div>
            </article>
          );
        })}
      </div>

      <footer style={{ marginTop: 56, color: "#475569", fontSize: 13 }}>
        Edit this site by pushing to its repository — every push deploys.
      </footer>
    </main>
  );
}
