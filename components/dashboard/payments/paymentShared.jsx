/* Shared by PaymentDetailsDrawer and AdminPaymentReceipt */

export const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

export const formatDateOnly = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatAmount = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(Number(value || 0));

/* ---------- amount in words (Indian numbering, with paise) ---------- */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const three = (n) =>
  `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " : ""}` : ""}${n % 100 ? two(n % 100) : ""}`;

export const amountInWords = (amount) => {
  const total = Number(amount) || 0;
  let n = Math.floor(total);
  const paise = Math.round((total - n) * 100);
  const out = [];
  [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]].forEach(([div, label]) => {
    const q = Math.floor(n / div);
    if (q) { out.push(`${three(q)} ${label}`); n %= div; }
  });
  if (n) out.push(three(n));
  return `Rupees ${out.join(" ") || "Zero"}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
};

/* ---------- status badge + info row (same markup the drawer already used) ---------- */
export const getStatusClass = (status) => {
  const v = String(status || "").toUpperCase();
  const base = "admin-payment-drawer-status admin-payment-drawer-status-";
  if (["SUCCESS", "ACTIVE", "PAID"].includes(v)) return base + "success";
  if (["PENDING", "CREATED", "PAUSED"].includes(v)) return base + "warning";
  if (["FAILED", "REFUNDED", "REJECTED", "CANCELLED", "EXPIRED"].includes(v)) return base + "danger";
  return base + "neutral";
};

export function Info({ label, value }) {
  return (
    <div className="admin-payment-info-row">
      <span>{label}</span>
      <strong>{value || "N/A"}</strong>
    </div>
  );
}

export function StatusInfo({ label, status }) {
  return (
    <div className="admin-payment-info-row">
      <span>{label}</span>
      <strong>
        <span className={getStatusClass(status)}>{status || "N/A"}</span>
      </strong>
    </div>
  );
}