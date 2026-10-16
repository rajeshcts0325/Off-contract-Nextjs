"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { formatDate, formatDateOnly, formatAmount, amountInWords } from "./paymentShared";

const DECLARATION =
  "This receipt acknowledges that the payment described above has been received by Off Contract towards the " +
  "subscription plan stated herein. The subscription is provided subject to the Terms of Service of Off Contract. " +
  "Payments are processed securely through Razorpay. This receipt is valid only for the payment and period mentioned above.";

const INK = [17, 24, 39];
const cell = { border: "1px solid #d1d5db", padding: "8px 12px" };
const blockTitle = {
  fontSize: 11, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase",
  color: "#6b7280", marginBottom: 6,
};
const toolbarBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px",
  border: "none", borderRadius: 8, background: "#111827", color: "#fff",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};

/* logo as data URL for the PDF (null if missing) */
const loadLogo = async (src) => {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const size = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = reject;
      img.src = data;
    });
    return { data, ...size };
  } catch {
    return null;
  }
};

export default function AdminPaymentReceipt({ paymentId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/v1/admin/payments/${paymentId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Unable to load receipt");
        if (!cancelled) setReceipt(json.data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load receipt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [paymentId]);

  /* ---------- receipt data (single source for modal and PDF) ---------- */
  const issuer = receipt?.issuer || {};
  const customer = receipt?.customer || {};
  const business = receipt?.business || {};
  const subscription = receipt?.subscription || {};
  const payment = receipt?.payment || {};

  const receiptNo = receipt?.receiptNumber || "N/A";
  const paidOn = payment.paidAt || payment.createdAt;
  const isPaid = payment.status === "SUCCESS";
  const planName = subscription.plan?.name || "N/A";
  const billingCycle = subscription.billingCycle || subscription.plan?.billingCycle || "N/A";
  const servicePeriod = `${formatDateOnly(subscription.startDate)} to ${formatDateOnly(subscription.endDate)}`;
  const lineAmount = formatAmount(subscription.amount ?? payment.amount, payment.currency);
  const totalAmount = formatAmount(payment.amount, payment.currency);
  const words = amountInWords(payment.amount);

  const issuerLines = [
    issuer.address,
    issuer.email && `Email: ${issuer.email}`,
    issuer.gstin && `GSTIN: ${issuer.gstin}`,
  ].filter(Boolean);

  const receivedFrom = [
    customer.name,
    business.name,
    business.address,
    customer.email && `Email: ${customer.email}`,
    customer.phone && `Phone: ${customer.phone}`,
    business.gstNumber && `GSTIN: ${business.gstNumber}`,
    business.panNumber && `PAN: ${business.panNumber}`,
  ].filter(Boolean);

  const receiptMeta = [
    ["Receipt No.", receiptNo],
    ["Receipt Date", formatDateOnly(paidOn)],
    ["Payment Time", formatDate(paidOn)],
    ["Payment ID", payment.razorpayPaymentId || "N/A"],
    ["Subscription ID", subscription.razorpaySubscriptionId || "N/A"],
    ["Invoice ID", payment.razorpayInvoiceId || "N/A"],
    ["Payment Mode", "Online (Razorpay)"],
    ["Status", isPaid ? "PAID" : payment.status || "N/A"],
  ];

  /* ---------- PDF (same layout as the user receipt) ---------- */
  const downloadPDF = async () => {
    if (!receipt) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const logo = issuer.logo ? await loadLogo(issuer.logo) : null;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pdf = (s) => String(s).replace(/₹/g, "Rs. "); // built-in PDF fonts can't draw ₹
      const base = {
        theme: "grid",
        styles: { font: "times", fontSize: 10, cellPadding: 6, lineColor: [209, 213, 219], textColor: INK },
        headStyles: { fillColor: INK, textColor: 255, fontStyle: "bold" },
      };
      const finalY = () => doc.lastAutoTable.finalY;

      /* page border (double line) */
      doc.setDrawColor(...INK);
      doc.setLineWidth(1.5).rect(20, 20, 555, 802);
      doc.setLineWidth(0.4).rect(25, 25, 545, 792);

      /* header: logo + issuer (left), title + stamp (right) */
      let textX = 40;
      if (logo) {
        const h = 40;
        const w = Math.min(120, (logo.w / logo.h) * h);
        doc.addImage(logo.data, logo.data.startsWith("data:image/png") ? "PNG" : "JPEG", 40, 40, w, h);
        textX = 40 + w + 12;
      }
      doc.setFont("times", "bold").setFontSize(16).setTextColor(...INK).text(issuer.name || "", textX, 54);
      doc.setFont("times", "normal").setFontSize(9).setTextColor(90);
      issuerLines.forEach((line, i) => doc.text(line, textX, 68 + i * 11));

      doc.setFont("times", "bold").setFontSize(18).setTextColor(...INK)
        .text("PAYMENT RECEIPT", 555, 54, { align: "right" });
      if (isPaid) {
        doc.setDrawColor(22, 163, 74).setTextColor(22, 163, 74).setLineWidth(1.2);
        doc.roundedRect(495, 66, 60, 22, 3, 3, "S");
        doc.setFont("helvetica", "bold").setFontSize(12).text("PAID", 525, 81, { align: "center" });
      }
      doc.setDrawColor(...INK).setLineWidth(0.8).line(40, 104, 555, 104);

      /* received from (left) + payment details (right) */
      autoTable(doc, {
        ...base, startY: 120, margin: { left: 40 }, tableWidth: 240,
        head: [["Received From"]],
        body: receivedFrom.map((l) => [l]),
      });
      const leftEnd = finalY();
      autoTable(doc, {
        ...base, startY: 120, margin: { left: 300 }, tableWidth: 255,
        head: [[{ content: "Payment Details", colSpan: 2 }]],
        body: receiptMeta.map(([k, v]) => [k, pdf(v)]),
        columnStyles: { 0: { cellWidth: 80, fontStyle: "bold" } },
      });
      let y = Math.max(leftEnd, finalY()) + 20;

      /* itemised table + total */
      autoTable(doc, {
        ...base, startY: y, margin: { left: 40, right: 40 },
        head: [["Description", "Billing Cycle", "Service Period", "Amount"]],
        body: [[`${planName} Subscription`, billingCycle, servicePeriod, pdf(lineAmount)]],
        columnStyles: { 3: { halign: "right" } },
      });
      autoTable(doc, {
        ...base, startY: finalY(), margin: { left: 40, right: 40 },
        body: [["Total Amount Paid", pdf(totalAmount)]],
        styles: { ...base.styles, fontStyle: "bold", fontSize: 11 },
        columnStyles: { 0: { halign: "right" }, 1: { halign: "right", cellWidth: 130 } },
      });
      y = finalY() + 22;

      /* amount in words */
      doc.setFont("times", "italic").setFontSize(10).setTextColor(...INK);
      doc.text(`Amount in words: ${words}`, 40, y, { maxWidth: 515 });
      y += 32;

      /* declaration */
      doc.setFont("times", "bold").setFontSize(10).text("Declaration", 40, y);
      doc.setFont("times", "normal").setFontSize(9.5);
      const lines = doc.splitTextToSize(DECLARATION, 515);
      doc.text(lines, 40, y + 14);
      y += 14 + lines.length * 12 + 40;

      /* signature */
      doc.setFont("times", "bold").setFontSize(10).text(`For ${issuer.name || ""}`, 555, y, { align: "right" });
      doc.setLineWidth(0.5).line(405, y + 42, 555, y + 42);
      doc.setFont("times", "normal").text("Authorized Signatory", 555, y + 55, { align: "right" });

      /* footer */
      doc.setFontSize(8).setTextColor(110);
      doc.text(
        "This is a computer-generated receipt and does not require a physical signature.",
        297.5, 800, { align: "center" }
      );

      doc.save(`off-contract-receipt-${receiptNo}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  /* ---------- modal ---------- */
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 794, maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* toolbar (outside the paper) */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
          {receipt && !loading && (
            <button type="button" style={toolbarBtn} onClick={downloadPDF} disabled={downloading}>
              <Download size={16} /> {downloading ? "Preparing..." : "Download PDF"}
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: "#fff", border: "none", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {(loading || error) && (
          <div style={{
            background: "#fff", padding: 32, borderRadius: 8, textAlign: "center",
            color: error ? "#b3261e" : "#374151", fontWeight: 600,
          }}>
            {error || "Loading receipt..."}
          </div>
        )}

        {receipt && !loading && (
          /* paper */
          <div
            style={{
              background: "#fff", color: "#111827", padding: "32px 36px",
              border: "4px double #111827", fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            {/* header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              gap: 16, flexWrap: "wrap", paddingBottom: 16, borderBottom: "2px solid #111827",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {issuer.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={issuer.logo}
                    alt={issuer.name}
                    style={{ height: 52, width: "auto" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{issuer.name}</div>
                  <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>
                    {issuerLines.map((l) => <div key={l}>{l}</div>)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>PAYMENT RECEIPT</div>
                {isPaid && (
                  <div style={{
                    display: "inline-block", marginTop: 10, border: "2px solid #16a34a", color: "#16a34a",
                    padding: "2px 16px", fontWeight: 700, letterSpacing: 3, transform: "rotate(-6deg)",
                  }}>
                    PAID
                  </div>
                )}
              </div>
            </div>

            {/* received from + payment details */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24, margin: "20px 0",
            }}>
              <div>
                <div style={blockTitle}>Received From</div>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  {receivedFrom.map((l, i) => (
                    <div key={l} style={i === 0 ? { fontWeight: 700 } : undefined}>{l}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={blockTitle}>Payment Details</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <tbody>
                    {receiptMeta.map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...cell, fontWeight: 700, width: "38%" }}>{label}</td>
                        <td style={{ ...cell, wordBreak: "break-all" }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* itemised table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#111827", color: "#fff", textAlign: "left" }}>
                    <th style={cell}>Description</th>
                    <th style={cell}>Billing Cycle</th>
                    <th style={cell}>Service Period</th>
                    <th style={{ ...cell, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cell}>{planName} Subscription</td>
                    <td style={cell}>{billingCycle}</td>
                    <td style={cell}>{servicePeriod}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{lineAmount}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ ...cell, textAlign: "right", fontWeight: 700 }}>Total Amount Paid</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{totalAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 14, fontStyle: "italic", margin: "14px 0 24px" }}>
              Amount in words: {words}
            </p>

            {/* declaration */}
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>Declaration</strong>
              <p style={{ margin: "4px 0 0" }}>{DECLARATION}</p>
            </div>

            {/* signature */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 40 }}>
              <div style={{ textAlign: "center", minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>For {issuer.name}</div>
                <div style={{ borderBottom: "1px solid #111827", height: 44 }} />
                <div style={{ fontSize: 13, marginTop: 4 }}>Authorized Signatory</div>
              </div>
            </div>

            <div style={{
              marginTop: 28, paddingTop: 10, borderTop: "1px solid #d1d5db",
              textAlign: "center", fontSize: 11, color: "#6b7280",
            }}>
              This is a computer-generated receipt and does not require a physical signature.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}