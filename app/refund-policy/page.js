export const metadata = { title: "Refund & Cancellation Policy" };

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoTubeAI";
const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || "[Your company name]";
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "[support email]";

export default function RefundPolicy() {
  return (
    <main className="legal">
      <a href="/" style={{ color: "#00e87a", fontSize: 13 }}>← Home</a>
      <h1 style={{ marginTop: 16 }}>Refund &amp; Cancellation Policy</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>{NAME} is a subscription service operated by {COMPANY}. This policy explains how billing, cancellation and refunds work.</p>

      <h2>Subscriptions</h2>
      <p>{NAME} is sold as a monthly or annual subscription. Your subscription renews automatically at the end of each billing period, using the card you paid with, until you cancel. The price is shown on our website and at checkout before you pay.</p>

      <h2>Cancel anytime</h2>
      <ul>
        <li>You can cancel at any time from inside the app: <strong>⚙️ Settings → Cancel subscription</strong>. You can also email us at {EMAIL} and we will cancel it for you.</li>
        <li>When you cancel, you will not be charged again.</li>
        <li>You keep full access until the end of the period you have already paid for. After that, your access code stops working.</li>
      </ul>

      <h2>No refunds</h2>
      <p>Because {NAME} gives you instant access to the full service, <strong>all payments are non-refundable</strong>, including partially used months or years and renewals you forgot to cancel. We do not offer prorated refunds when you cancel mid-period.</p>

      <h2>Exceptions</h2>
      <p>We will refund a payment if you were charged in error — for example, a duplicate charge for the same period, or a charge made after you had already cancelled. Contact us within 14 days of the charge at {EMAIL} with your payment email and receipt, and we will review it promptly. This policy does not limit any rights you have under the consumer laws of your country.</p>

      <h2>Contact</h2>
      <p>Questions about billing? Email {EMAIL}.</p>
    </main>
  );
}
