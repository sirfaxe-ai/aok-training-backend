import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

// -----------------------------
// OPENAI
// -----------------------------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -----------------------------
// CORS FIX – sicher und robust
// -----------------------------
let allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

// ungültige Zeichen rausfiltern
if (typeof allowedOrigin === "string") {
  allowedOrigin = allowedOrigin.replace(/["'\s]/g, "");
  if (allowedOrigin.trim() === "") {
    allowedOrigin = "*";
  }
}

app.use(
  cors({
    origin: allowedOrigin,
    credentials: false,
  })
);

app.use(express.json({ limit: "50mb" }));

// -----------------------------
// PROFILE BESCHREIBUNGEN
// -----------------------------
const profileDescriptions = {
  K1: "Daniel Koch (38), sportlicher Familienvater.",
  K2: "Jasmin Hoffmann (31), alleinerziehend, gestresst.",
  K3: "Horst Meier (72), skeptischer Rentner.",
  K4: "Lea Weber (24), Berufseinsteigerin.",
  K5: "Mehmet Arslan (44), selbstständig, pragmatisch.",
  K6: "Nadine Krüger (36), Familienmanagerin.",
  K7: "Wolfgang Lüders (68), skeptisch.",
  K8: "Anna Berger (29), junge Mutter.",
  K9: "Christian Falk (42), IT-Führungskraft.",
  K10:"Patrick Sommer (34), freundlich.",
};

// -----------------------------
// 1) CHAT – KI KUNDE
// -----------------------------
app.post("/chat", async (req, res) => {
  try {
    const { profileId, history } = req.body;

    const profilText =
      profileDescriptions[profileId] || "Privatkunde, normale Stimmung.";

    const systemPrompt = `
Du bist ein realistischer AOK NordWest Privatkunde.

VERHALTEN:
- Am Telefon meldest du dich wie echte Menschen: "Ja?", "Hallo?", "[Nachname]?"
- KEINE Vorstellung wie: "Ich bin XY, 31 Jahre alt…"
- Kurze Antworten (1-2 Sätze)
- Verhalte dich so, wie es dein Profil beschreibt:
  ${profilText}

WICHTIG:
- Du gibst NIEMALS Infos preis, die ein echter Kunde nicht sagen würde.
- Bleibe IMMER authentisch.
`.trim();

    const messages = [{ role: "system", content: systemPrompt }];

    if (Array.isArray(history)) {
      messages.push(...history);
    } else {
      messages.push({ role: "user", content: "Gespräch beginnen." });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Entschuldigung, da ist etwas schiefgelaufen.";

    res.json({ reply });
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});

// -----------------------------
// 2) SPEECH TO TEXT – GPT-4o Transcribe
// -----------------------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 fehlt" });
    }

    const buffer = Buffer.from(audioBase64, "base64");

    const result = await client.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file: buffer,
      response_format: "json",
    });

    res.json({ text: result.text });
  } catch (err) {
    console.error("Transcribe Error:", err);
    res.status(500).json({ error: "Whisper-Fehler" });
  }
});

// -----------------------------
// 3) TTS – NUR GÜLTIGE STIMMEN
// -----------------------------
const validVoices = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
  "coral",
  "verse",
  "ballad",
  "ash",
  "sage",
  "marin",
  "cedar",
];

// Stimme pro Profil (alles gültig!)
const voiceMap = {
  K1: "alloy",
  K2: "verse",
  K3: "sage",
  K4: "alloy",
  K5: "alloy",
  K6: "verse",
  K7: "sage",
  K8: "verse",
  K9: "alloy",
  K10:"alloy",
};

app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    let voice = voiceMap[profileId] || "alloy";

    // Falls irgendwie doch eine ungültige Stimme auftaucht → fallback
    if (!validVoices.includes(voice)) {
      voice = "alloy";
    }

    const audio = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      format: "wav",
    });

    const wav = Buffer.from(await audio.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.send(wav);
  } catch (err) {
    console.error("TTS Fehler:", err);
    res.status(500).json({ error: "TTS-Fehler" });
  }
});

// -----------------------------
// 4) FEEDBACK
// -----------------------------
app.post("/feedback", async (req, res) => {
  try {
    const { transcript } = req.body;

    const prompt = `
Gib klares, direkt anwendbares Feedback für AOK Telefontraining:

Antwort:
"${transcript}"

Beurteile:
- Tonalität
- Geschwindigkeit
- Professionalität
- Gesprächsführung
- Verbesserungen in 3–5 Bullet Points
- Schulnote (1–6)
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ feedback: completion.choices[0].message.content });
  } catch (err) {
    console.error("Feedback Fehler:", err);
    res.status(500).json({ error: "Feedback-Fehler" });
  }
});

// -----------------------------
// ROOT
// -----------------------------
app.get("/", (req, res) => {
  res.send("AOK Training Backend läuft.");
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
