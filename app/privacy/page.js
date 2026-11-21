export const metadata = { title: "Privacy Policy" };

const NAME = process.env.NEXT_PUBLIC_APP_NAME || "AutoTubeAI";
const COMPANY = process.env.NEXT_PUBLIC_COMPANY_NAME || "[Your company name]";
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "[support email]";

// TEMPLATE — have this reviewed for your jurisdiction (GDPR/CCPA etc.) before selling.
export default function Privacy() {
  return (
    <main className="legal">
      <a href="/" style={{ color: "#00e87a", fontSize: 13 }}>← Home</a>
      <h1 style={{ marginTop: 16 }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>This policy explains how {COMPANY} handles information when you use {NAME}.</p>
      <h2>What we process</h2>
      <ul>
        <li><strong>Your inputs</strong> — topics, URLs, uploaded documents and channel stats you enter are sent to our server to generate a response.</li>
        <li><strong>AI processing</strong> — inputs are sent to our AI provider, Anthropic, to generate output. See Anthropic's privacy policy for how they handle API data.</li>
        <li><strong>Fetched content</strong> — when you paste a link, our server fetches that public page or video's metadata and transcript.</li>
        <li><strong>Technical data</strong> — IP address and access code are used for rate limiting and abuse prevention.</li>
      </ul>
      <h2>What stays on your device</h2>
      <p>Your library of generated content, channel stats and settings are stored in your browser's local storage. We do not store them on our servers. Clearing your browser data deletes them.</p>
      <h2>Payments</h2>
      <p>Payments are handled by our payment processor. We do not see or store your card details.</p>
      <h2>Sharing</h2>
      <p>We do not sell your personal information. We share data only with the service providers needed to run {NAME} (hosting, AI processing, payments).</p>
      <h2>Your rights</h2>
      <p>Depending on where you live, you may have rights to access, correct or delete your data. Contact us to make a request.</p>
      <h2>Contact</h2>
      <p>{EMAIL}</p>
    </main>
  );
}
