import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

// KI-Client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
app.use(cors({
  origin: allowedOrigin,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Profile
const profileDescriptions = {
  K1: "Daniel Koch (38), sportlicher Familienvater, Elektriker.",
  K2: "Jasmin Hoffmann (31), alleinerziehend, gestresst, wenig Zeit.",
  K3: "Horst Meier (72), Rentner, ruhiges Temperament, skeptisch.",
  K4: "Lea Weber (24), Berufseinsteigerin, freundlich, offen.",
  K5: "Mehmet Arslan (44), selbstständig, pragmatisch, knapp angebunden.",
  K6: "Nadine Krüger (36), Familienmanagerin, oft gehetzt, freundlich.",
  K7: "Wolfgang Lüders (68), skeptisch, hinterfragt alles.",
  K8: "Anna Berger (29), junge Mutter, vorsichtig, sicherheitsbedacht.",
  K9: "Christian Falk (42), IT-Führungskraft, effizient, will klare Infos.",
  K10:"Patrick Sommer (34), sehr freundlich, offen, gesprächig."
};


/* -------------------------------------------------------
   1) CUSTOMER REPLY (CHAT)
-------------------------------------------------------- */
app.post('/chat', async (req, res) => {
  try {
    const { profileId, history } = req.body;
    const profilText = profileDescriptions[profileId] || "Unbekannt";

    const systemPrompt = `
Du bist ein realistischer AOK-NordWest-Kunde im Telefontraining.

WICHTIG:
- Sprich NIEMALS über dein Profil oder deine Eigenschaften!
- Melde dich wie ein echter Privatkunde: z.B. "Ja?", "Weber hier.", "Hallo?"
- Keine langen Monologe – 1–2 Sätze.
- Weise natürliche Stimmung auf (gestresst, skeptisch, freundlich … abhängig vom Profil)
- Gib NIEMALS Infos preis, die kein echter Kunde sagen würde.

Dein Profil:
${profilText}
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || [])
    ];

    if (!history || history.length === 0) {
      messages.push({ role: "user", content: "Gespräch beginnen." });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});


/* -------------------------------------------------------
   2) SPEECH TO TEXT (WHISPER)
   → kompatibel mit deinem Frontend (Base64)
-------------------------------------------------------- */
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 fehlt" });
    }

    // Base64 → Buffer
    const buffer = Buffer.from(audioBase64, "base64");

    // GPT-4o Transcribe versteht Buffer direkt ❤️
    const transcription = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe",
      response_format: "json"
    });

    res.json({ text: transcription.text });

  } catch (err) {
    console.error("Whisper Fehler:", err.response?.data || err);
    res.status(500).json({ error: "Whisper-Fehler" });
  }
});


/* -------------------------------------------------------
   3) TEXT TO SPEECH (OPENAI)
   → gibt WAV zurück, wie dein Frontend erwartet
-------------------------------------------------------- */
app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

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
      K10:"alloy"
    };

    const voice = voiceMap[profileId] || "alloy";

    const tts = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      format: "wav"
    });

    const wav = Buffer.from(await tts.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.send(wav);

  } catch (err) {
    console.error("TTS Fehler:", err);
    res.status(500).json({ error: "TTS-Fehler" });
  }
});


/* -------------------------------------------------------
   4) FEEDBACK
-------------------------------------------------------- */
app.post("/feedback", async (req, res) => {
  try {
    const { transcript, profileId } = req.body;

    const prompt = `
Gib ein präzises Feedback zu dieser Antwort eines AOK-Telefonmitarbeiters.

Kriterien:
- Tonalität (freundlich, empathisch, ruhig?)
- Geschwindigkeit (zu schnell / zu langsam?)
- Gesprächsführung
- Bedarfsanalyse gut / schlecht?
- Zu viel Monolog?
- Professionelles Wording?
- Verbesserungsvorschläge in 3–5 Bullet Points.

Antwort des Mitarbeiters:
"${transcript}"
    `.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ feedback: completion.choices[0].message.content });

  } catch (err) {
    console.error("Feedback Fehler:", err);
    res.status(500).json({ error: "Feedback-Fehler" });
  }
});


/* -------------------------------------------------------
   ROOT
-------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("AOK Telefontraining Backend läuft.");
});

app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});
