export const metadata = { title: "Terms of Service" };

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoTubeAI";
const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || "[Your company name]";
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "[support email]";

// TEMPLATE — have this reviewed for your jurisdiction before selling.
export default function Terms() {
  return (
    <main className="legal">
      <a href="/" style={{ color: "#00e87a", fontSize: 13 }}>← Home</a>
      <h1 style={{ marginTop: 16 }}>Terms of Service</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>These terms govern your use of {NAME}, operated by {COMPANY}. By using the service you agree to them.</p>
      <h2>The service</h2>
      <p>{NAME} uses artificial intelligence to generate content suggestions such as scripts, titles, keywords and plans. AI output can be inaccurate or incomplete. You are responsible for reviewing it and for everything you publish.</p>
      <h2>Your account and access codes</h2>
      <p>Access codes are for the purchaser only and must not be shared or resold. We may suspend access that is shared, abused, or used to violate these terms. Fair-use limits apply.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the service to create content that is illegal, infringing, deceptive, hateful or harassing.</li>
        <li>Follow YouTube's Terms of Service and Community Guidelines, including its policies on reused and AI-generated content.</li>
        <li>Do not attempt to overload, reverse engineer or misuse the service.</li>
      </ul>
      <h2>Content ownership</h2>
      <p>You own the inputs you provide and, to the extent permitted by law, the output generated for you. Content you analyse (videos, websites, documents) remains the property of its owners.</p>
      <h2>No guarantees</h2>
      <p>We do not guarantee views, subscribers, revenue or any other result. The service is provided "as is" without warranties of any kind.</p>
      <h2>Payments and refunds</h2>
      <p>Prices and billing terms are shown at checkout. Subscriptions renew automatically until cancelled. You can cancel at any time and keep access until the end of the period you have paid for. Payments are non-refundable except for charges made in error — see our <a href="/refund-policy" style={{ color: "#00e87a" }}>Refund &amp; Cancellation Policy</a>.</p>
      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, {COMPANY} is not liable for indirect or consequential damages, and total liability is limited to the amount you paid in the 3 months before the claim.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Continued use after changes means you accept them.</p>
      <h2>Contact</h2>
      <p>{EMAIL}</p>
    </main>
  );
}
