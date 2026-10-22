import { ImageResponse } from "next/og";

export const alt = "Common Ground: four friends' tastes in, one plan everyone likes out";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fictional sample people; no Qloo data in the image.
const FRIENDS = [
  { name: "Asha", tastes: "AR Rahman · Kumbalangi Nights · filter coffee" },
  { name: "Ravi", tastes: "Diljit Dosanjh · RRR · biryani" },
  { name: "Meera", tastes: "Prateek Kuhad · Panchayat · Toit" },
  { name: "Karthik", tastes: "Anirudh · Kantara · Sid Sriram" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0f1512", color: "#f2f5f3", padding: 56 }}>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700 }}>Common Ground</div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 12, color: "#b9c6bf", maxWidth: 1000 }}>
          Knows what each of you loves and finds the plan where those tastes overlap.
        </div>
        <div style={{ display: "flex", marginTop: 44, gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 560 }}>
            {FRIENDS.map((f) => (
              <div key={f.name} style={{ display: "flex", flexDirection: "column", background: "#1b2420", borderRadius: 16, padding: "12px 18px" }}>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{f.name}</div>
                <div style={{ display: "flex", fontSize: 20, color: "#b9c6bf" }}>{f.tastes}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 64, color: "#25D366" }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", background: "#dcf8c6", color: "#111", borderRadius: 24, padding: 28, width: 420 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>Saturday: one place</div>
            <div style={{ display: "flex", fontSize: 22, marginTop: 8 }}>everyone&apos;s tastes overlap on,</div>
            <div style={{ display: "flex", fontSize: 22 }}>with a reason for each friend</div>
            <div style={{ display: "flex", fontSize: 18, marginTop: 18, color: "#3b4a42" }}>Grounded in the Qloo taste graph</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
