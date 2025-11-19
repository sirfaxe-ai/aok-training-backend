import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

// OpenAI-Client mit API-Key aus Env
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS: für Trainingszwecke alle Origins erlauben
app.use(cors());
app.use(express.json());

// Profilbeschreibungen für die Kundentypen (für den Chat)
const profileDescriptions = {
  K1: "Daniel Koch (38), sportlicher Familienvater, Elektriker, zwei Kinder, Rückenprobleme, will fit bleiben.",
  K2: "Jasmin Hoffmann (31), alleinerziehend, im Einzelhandel, viel Stress, wenig Zeit.",
  K3: "Horst Meier (72), Rentner, Rückenschmerzen, lebt allein, will mobil bleiben.",
  K4: "Lea Weber (24), Berufseinsteigerin im Büro, will sich besser um ihre Gesundheit kümmern.",
  K5: "Mehmet Arslan (44), selbstständiger Handwerker, hohe körperliche Belastung, wenig Zeit.",
  K6: "Nadine Krüger (36), Familienmanagerin, WhatsApp-Typ, zwei Kinder, immer in Eile.",
  K7: "Wolfgang Lüders (68), skeptischer Rentner, fragt viel nach Kosten und Bedingungen.",
  K8: "Anna Berger (29), junge Mutter mit Baby, unsicher, braucht Sicherheit und Beratung.",
  K9: "Christian Falk (42), IT-Führungskraft, wenig Zeit, will schnell auf den Punkt kommen.",
  K10: "Patrick Sommer (34), sehr freundlicher Typ, offen, interessiert an Gesundheit.",
};

// Stimmprofile pro Kundentyp für die TTS-Ausgabe
const voiceProfiles = {
  K1:  { voice: "alloy",  style: "neutral, gelassen, freundlich" },
  K2:  { voice: "nova",   style: "jung, gestresst, leicht erschöpft" },
  K3:  { voice: "dexter", style: "älter, langsam, leicht müde" },
  K4:  { voice: "shimmer",style: "jung, klar, dynamisch" },
  K5:  { voice: "verse",  style: "erwachsen, sachlich, kurz angebunden" },
  K6:  { voice: "sage",   style: "freundlich, warm, kommunikativ" },
  K7:  { voice: "dexter", style: "skeptisch, misstrauisch, langsam" },
  K8:  { voice: "nova",   style: "jung, freundlich, beruhigend" },
  K9:  { voice: "verse",  style: "sachlich, direkt, effizient" },
  K10: { voice: "shimmer",style: "locker, positiv, gut gelaunt" },
};

// Healthcheck
app.get("/", (req, res) => {
  res.send("AOK Telefontraining Backend läuft.");
});

// POST /chat  ->  nimmt history + profileId an, antwortet mit Kundentext (nur Text)
app.post("/chat", async (req, res) => {
  try {
    const { profileId, history } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: "profileId fehlt" });
    }

    const profilText =
      profileDescriptions[profileId] ||
      "unbekanntes Profil, verhalte dich neutral.";

    const systemPrompt = `
Du bist ein KUNDE der AOK NordWest in einem Telefontraining.
Sprich NUR als Kunde, niemals als KI oder Computer.
Sprich in kurzen, natürlichen Sätzen, ganz normale Umgangssprache.

Dein Profil:
${profileId}: ${profilText}

Dein Gesprächspartner ist eine AOK-Telefonkraft, die eine Bedarfsanalyse macht,
Produkte und Services erklärt und das Gespräch zum Abschluss bringen soll.

Verhalte dich realistisch entsprechend dieses Profils
(z.B. gestresst, skeptisch, offen, unsicher).
Nenne gerne die AOK NordWest, aber keine echten persönlichen Daten.

Wenn das Gespräch startet, melde dich wie ein Kunde am Telefon,
z.B. "Ja hallo, hier ist ${profilText.split(",")[0]}, worum geht es denn?".
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []),
    ];

    // Falls noch keine History: Kunde beginnt das Gespräch
    if (!history || history.length === 0) {
      messages.push({
        role: "user",
        content:
          "Starte das Gespräch, indem du dich als Kunde meldest und fragst, worum es geht.",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Entschuldigung, ich habe dich gerade nicht verstanden.";

    return res.json({ reply });
  } catch (err) {
    console.error("Fehler in /chat:", err);
    return res
      .status(500)
      .json({ error: "Fehler bei der KI-Antwort", details: String(err) });
  }
});

// POST /voice -> erzeugt passende Audio-Stimme je nach Kunde
app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    if (!text || !profileId) {
      return res.status(400).json({ error: "Text oder profileId fehlt" });
    }

    const vp = voiceProfiles[profileId] || voiceProfiles["K1"];

    const ttsInput = `
Sprich den folgenden Text als simulierte Telefonkundin oder -kunde.
Emotion / Sprechstil: ${vp.style}
Sprich natürlich, so wie am Telefon.

Text:
${text}
    `.trim();

    const audioResponse = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: vp.voice,
      input: ttsInput,
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
    });

    res.send(buffer);
  } catch (err) {
    console.error("Fehler in /voice:", err);
    res
      .status(500)
      .json({ error: "TTS fehlgeschlagen", details: String(err) });
  }
});

// Serverstart
app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});

