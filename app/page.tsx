"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Demo bill එකට redirect කරනවා
    // Production එකේදී මේක remove කරන්න
    router.push("/bill?id=4bmCGztDtSdVmGUTaDyjfQ");
  }, [router]);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #F0F4FF 0%, #F8F9FB 50%, #FFF8F0 100%)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 60,
            height: 60,
            border: "4px solid #E8EAF6",
            borderTop: "4px solid #003D9B",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 20px",
          }}
        />
        <p
          style={{
            color: "#434654",
            fontSize: 16,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
          }}
        >
          Redirecting...
        </p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}