// Minimal diagnostic — no PDF, just a plain text call.
// Run: node --env-file=.env test.js
import Anthropic from "@anthropic-ai/sdk";

console.log("Node:", process.version);
console.log("API key present:", Boolean(process.env.ANTHROPIC_API_KEY));

const anthropic = new Anthropic();
try {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 50,
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
  });
  console.log("SUCCESS:", msg.content.map((b) => b.text).join(""));
} catch (e) {
  console.error("FAILED — status:", e.status);
  console.error("message:", e.message);
  if (e.error) console.error("body:", JSON.stringify(e.error, null, 2));
}