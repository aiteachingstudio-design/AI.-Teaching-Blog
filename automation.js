// ============================================================
//  AI Teaching Studio — Daily Article Automation Script
//  Runs every day via GitHub Actions
//  Generates new AI articles using Claude API
//  Saves them to articles.json which your blog reads
// ============================================================

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── CONFIG ──────────────────────────────────────────────────
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // Set in GitHub Secrets
const MODEL = "claude-sonnet-4-6";
const ARTICLES_FILE = path.join(__dirname, "articles.json");
const HOW_MANY_NEW = 2; // Generate 2 new articles per day

// ── TOPIC POOL ──────────────────────────────────────────────
// Add more topics here — script picks randomly each day
const TOPICS = [
  { title: "What is ChatGPT and How Does It Work?",         cat: "AI Basics",          emoji: "💬", color: "#7C3AED" },
  { title: "How to Use AI Tools in Your Classroom Today",   cat: "For Teachers",        emoji: "🎓", color: "#F59E0B" },
  { title: "Machine Learning Explained for Beginners",      cat: "Machine Learning",    emoji: "🧠", color: "#F97316" },
  { title: "Top 5 AI Prompt Writing Tips for Teachers",     cat: "Prompt Engineering",  emoji: "✍️", color: "#A855F7" },
  { title: "Deep Learning vs Machine Learning — Simplified",cat: "Deep Learning",       emoji: "🔬", color: "#EF4444" },
  { title: "How AI is Changing Education in 2026",          cat: "AI in Education",     emoji: "📚", color: "#22c55e" },
  { title: "Google Gemini for Teachers — Full Guide",       cat: "AI Tools",            emoji: "⚡", color: "#14b8a6" },
  { title: "How to Fact-Check AI Output in the Classroom",  cat: "For Teachers",        emoji: "🔍", color: "#eab308" },
  { title: "What is a Neural Network? A Visual Guide",      cat: "AI Basics",           emoji: "🕸️", color: "#d946ef" },
  { title: "AI Ethics: What Teachers Need to Know",         cat: "AI Ethics",           emoji: "⚖️", color: "#3b82f6" },
  { title: "How to Start a Career in AI as a Teacher",      cat: "Career in AI",        emoji: "💼", color: "#ec4899" },
  { title: "Large Language Models Explained Simply",        cat: "AI Basics",           emoji: "🤖", color: "#8b5cf6" },
  { title: "Using AI to Personalise Student Learning",      cat: "For Teachers",        emoji: "🎯", color: "#10b981" },
  { title: "What is Prompt Engineering and Why It Matters", cat: "Prompt Engineering",  emoji: "🛠️", color: "#f59e0b" },
  { title: "How to Teach AI Responsibly to Students",       cat: "AI Ethics",           emoji: "🌱", color: "#6366f1" },
];

// ── HELPER: Call Claude API ──────────────────────────────────
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: `You are a warm, enthusiastic AI education writer for "AI Teaching Studio" — a blog for teachers.
Write in a friendly, encouraging, beginner-friendly tone with natural emoji use.
Format your response as valid JSON only — no markdown, no code blocks, no extra text.
Return this exact structure:
{
  "excerpt": "One sentence summary of the article (max 20 words)",
  "readTime": "X min read",
  "content": "Full HTML article content using <p>, <h2>, <h3>, <ul>, <li> tags only. Include a callout div like: <div class=\\"callout\\"><p>💡 Tip: ...</p></div>"
}`,
      messages: [
        {
          role: "user",
          content: `Write a complete beginner-friendly blog article for teachers about: "${prompt}". 
Include an intro, 2-3 sections with h2 headings, a 💡 tip callout, and an encouraging closing paragraph. Around 350 words.`,
        },
      ],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content.map((b) => b.text || "").join("");
          const article = JSON.parse(text);
          resolve(article);
        } catch (err) {
          reject(new Error("Failed to parse Claude response: " + err.message));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── HELPER: Pick unused random topics ───────────────────────
function pickRandomTopics(existing, count) {
  const usedTitles = new Set(existing.map((a) => a.title));
  const available = TOPICS.filter((t) => !usedTitles.has(t.title));

  if (available.length === 0) {
    console.log("⚠️  All topics used — reshuffling from full pool.");
    return TOPICS.sort(() => Math.random() - 0.5).slice(0, count);
  }

  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, available.length));
}

// ── HELPER: Format today's date ──────────────────────────────
function todayDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 AI Teaching Studio — Daily Automation Started");
  console.log(`📅 Date: ${todayDate()}`);
  console.log(`📝 Generating ${HOW_MANY_NEW} new article(s)...\n`);

  if (!CLAUDE_API_KEY) {
    console.error("❌ CLAUDE_API_KEY not set. Add it to GitHub Secrets.");
    process.exit(1);
  }

  // Load existing articles
  let articles = [];
  if (fs.existsSync(ARTICLES_FILE)) {
    articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf8"));
    console.log(`📚 Loaded ${articles.length} existing articles.`);
  } else {
    console.log("📂 No existing articles file — creating fresh.");
  }

  // Pick today's topics
  const todaysTopics = pickRandomTopics(articles, HOW_MANY_NEW);
  console.log("🎯 Topics chosen:");
  todaysTopics.forEach((t) => console.log(`   • ${t.title}`));
  console.log("");

  // Generate articles
  for (const topic of todaysTopics) {
    console.log(`✍️  Writing: "${topic.title}"...`);
    try {
      const result = await callClaude(topic.title);

      const newArticle = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: topic.title,
        cat: topic.cat,
        emoji: topic.emoji,
        color: topic.color,
        author: pickRandom(["Ahmed Khan", "Sara Ali", "Zara Malik", "Omar Farooq"]),
        initials: "AK",
        date: todayDate(),
        readTime: result.readTime || "5 min read",
        excerpt: result.excerpt || "A fresh AI article for educators.",
        content: result.content || "<p>Content coming soon.</p>",
      };

      articles.unshift(newArticle); // Add to top
      console.log(`   ✅ Done! "${topic.title}"`);

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  // Keep only last 50 articles (to keep file size small)
  if (articles.length > 50) {
    articles = articles.slice(0, 50);
    console.log("🧹 Trimmed to 50 articles.");
  }

  // Save back to file
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2));
  console.log(`\n💾 Saved ${articles.length} articles to articles.json`);
  console.log("🎉 Automation complete! Blog will update automatically.");
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

main().catch((err) => {
  console.error("💥 Fatal error:", err.message);
  process.exit(1);
});
