"use client";

import { X } from "lucide-react";
import { Info, StatusInfo, formatDate, formatAmount } from "./paymentShared";

export default function PaymentDetailsDrawer({ payment, open, onClose }) {
  if (!open || !payment) return null;

  const user = payment.user;
  const company = payment.company;
  const transaction = payment.payment;
  const subscription = payment.subscription;

  return (
    <div className="admin-payment-drawer-overlay" onClick={onClose}>
      <aside className="admin-payment-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="admin-payment-drawer-header">
          <div>
            <h3>Payment Details</h3>
            <p>{user?.name || user?.email || "Payment Transaction"}</p>
          </div>
          <button type="button" onClick={onClose} className="admin-payment-drawer-close" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="admin-payment-drawer-body">
          <section>
            <h4>Payment Information</h4>
            <Info label="Payment ID" value={transaction?.id} />
            <Info label="Razorpay Payment ID" value={transaction?.razorpayPaymentId} />
            <Info label="Razorpay Subscription ID" value={subscription?.razorpaySubscriptionId} />
            <Info label="Razorpay Invoice ID" value={transaction?.razorpayInvoiceId} />
            <Info label="Amount" value={formatAmount(transaction?.amount, transaction?.currency)} />
            <Info label="Currency" value={transaction?.currency} />
            <StatusInfo label="Payment Status" status={transaction?.status} />
            {transaction?.failureReason && (
              <Info label="Failure Reason" value={transaction.failureReason} />
            )}
            <Info label="Created At" value={formatDate(transaction?.createdAt)} />
            <Info label="Paid At" value={formatDate(transaction?.paidAt)} />
          </section>

          <section>
            <h4>User Information</h4>
            <Info label="Name" value={user?.name} />
            <Info label="Email" value={user?.email} />
          </section>

          <section>
            <h4>Company Information</h4>
            <Info label="Company Name" value={company?.name} />
            <Info label="Business Type" value={company?.businessType} />
            <Info label="GST Number" value={company?.gstNumber} />
            <Info label="PAN Number" value={company?.panNumber} />
            <Info label="Registration Number" value={company?.registrationNumber} />
            <Info label="Business Email" value={company?.businessEmail} />
            <Info label="Business Phone" value={company?.businessPhone} />
            <Info label="Address" value={company?.address} />
          </section>

          <section>
            <h4>Subscription Information</h4>
            <Info label="Plan" value={subscription?.plan?.name || subscription?.planName} />
            <Info label="Billing Cycle" value={subscription?.billingCycle} />
            <StatusInfo label="Status" status={subscription?.status} />
            <Info label="Start Date" value={formatDate(subscription?.startDate)} />
            <Info label="Valid Till" value={formatDate(subscription?.endDate)} />
            {subscription?.cancelledAt && (
              <Info label="Cancelled At" value={formatDate(subscription.cancelledAt)} />
            )}
            <Info label="Created At" value={formatDate(subscription?.createdAt)} />
          </section>
        </div>
      </aside>
    </div>
  );
}