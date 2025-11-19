import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";
import { randomUUID } from "crypto";

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS – bewusst einfach halten, damit keine Header-Fehler mehr auftreten
app.use(
  cors({
    origin: true,      // erlaubt den Origin der anfragenden Seite
    credentials: false // wir brauchen keine Cookies/Creds
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --------------------------------------
// Profile + Stimmen
// --------------------------------------
const profiles = {
  K1: {
    name: "Daniel Koch",
    beschreibung:
      "38 Jahre, sportlicher Familienvater, Elektriker. Beruflich viel unterwegs, möchte fit und leistungsfähig bleiben.",
    geschlecht: "m",
    nachname: "Koch",
    voice: "alloy", // männlich/neutral
  },
  K2: {
    name: "Jasmin Hoffmann",
    beschreibung:
      "31 Jahre, alleinerziehend, gestresst, wenig Zeit, aber grundsätzlich interessiert an Gesundheit und Entlastung.",
    geschlecht: "w",
    nachname: "Hoffmann",
    voice: "nova", // eher weiblich
  },
  K3: {
    name: "Horst Meier",
    beschreibung:
      "72 Jahre, Rentner, ruhiges Temperament, skeptisch, hat Rückenprobleme und ist vorsichtig bei neuen Angeboten.",
    geschlecht: "m",
    nachname: "Meier",
    voice: "sage", // ältere, ruhigere männliche Stimme
  },
  K4: {
    name: "Lea Weber",
    beschreibung:
      "24 Jahre, Berufseinsteigerin, freundlich, offen, eher knapp in den Antworten, digitalaffin.",
    geschlecht: "w",
    nachname: "Weber",
    voice: "verse", // weiblich
  },
  K5: {
    name: "Mehmet Arslan",
    beschreibung:
      "44 Jahre, selbstständiger Handwerker, wenig Zeit, klar und direkt, möchte keinen Verkaufsschnickschnack.",
    geschlecht: "m",
    nachname: "Arslan",
    voice: "ballad", // männlich
  },
  K6: {
    name: "Nadine Krüger",
    beschreibung:
      "36 Jahre, Familienmanagerin, Kinder, Haushalt, viel Stress, achtet auf Gesundheit der Familie.",
    geschlecht: "w",
    nachname: "Krüger",
    voice: "coral", // weiblich
  },
  K7: {
    name: "Wolfgang Lüders",
    beschreibung:
      "68 Jahre, skeptischer Rentner, hat schon viele Anrufe erlebt, stellt kritische Fragen.",
    geschlecht: "m",
    nachname: "Lüders",
    voice: "ash", // männlich
  },
  K8: {
    name: "Anna Berger",
    beschreibung:
      "29 Jahre, junge Mutter, müde, wenig Zeit, interessiert an Angeboten rund um Familie und Kind.",
    geschlecht: "w",
    nachname: "Berger",
    voice: "fable", // weiblich
  },
  K9: {
    name: "Christian Falk",
    beschreibung:
      "42 Jahre, IT-Führungskraft, analytisch, stellt konkrete Fragen, schätzt Struktur und Klarheit.",
    geschlecht: "m",
    nachname: "Falk",
    voice: "marin", // männlich
  },
  K10: {
    name: "Patrick Sommer",
    beschreibung:
      "34 Jahre, freundlicher Typ, grundsätzlich positiv eingestellt, möchte trotzdem einen klaren Nutzen erkennen.",
    geschlecht: "m",
    nachname: "Sommer",
    voice: "cedar", // männlich
  },
};

// --------------------------------------
// Hilfsfunktionen
// --------------------------------------
function buildSystemPrompt(profileId) {
  const profile = profiles[profileId];

  const base = profile
    ? `Du spielst die Privatperson "${profile.name}". Kurzbeschreibung: ${profile.beschreibung}.
Nachname, mit dem du dich am Telefon meldest: "${profile.nachname}".`
    : `Du spielst eine echte Privatperson, die von der AOK NordWest angerufen wird.`;

  return `
${base}

WICHTIG:
- Du bist der KUNDE, nicht der Mitarbeiter.
- Am Telefon meldest du dich wie echte Menschen, z.B.:
  - "Ja?"
  - "Hallo?"
  - "${profile?.nachname} hier."
- Wenn du deinen Namen nennst, benutze IMMER den Nachnamen "${profile?.nachname || "deinen Nachnamen"}".
- Sag NICHT: "Ich bin ein Trainingskunde" oder "Ich bin Profil K3" oder ähnliches.
- Keine langen Monologe: meist 1–3 Sätze.
- Deine Stimmung richtet sich nach der Beschreibung (gestresst, skeptisch, freundlich etc.).
- Antwort ist immer alltagsnah, wie ein echter Versicherter reagieren würde.

Wenn es noch keine Historie gibt, verhalte dich so, als würdest du den Anruf gerade annehmen.
  `.trim();
}

// --------------------------------------
// 1) KI-Kunde: /chat
// --------------------------------------
app.post("/chat", async (req, res) => {
  try {
    const { profileId, history } = req.body;
    const profile = profiles[profileId];

    if (!profile) {
      return res.status(400).json({ error: "Ungültige profileId" });
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(profileId) },
    ];

    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (!msg || !msg.role || !msg.content) continue;
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    } else {
      messages.push({
        role: "user",
        content:
          "Das ist der Start des Telefonats. Der Mitarbeiter hat sich gerade vorgestellt, du gehst ans Telefon.",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 180,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldigung, da ist gerade etwas schiefgelaufen.";

    res.json({ reply });
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});

// --------------------------------------
// 2) Speech-to-Text (Whisper) für webm
//    /transcribe
// --------------------------------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 fehlt" });
    }

    // Base64 → Buffer
    const buffer = Buffer.from(audioBase64, "base64");

    // temporäre Datei schreiben (webm)
    const tmpFile = `/tmp/${randomUUID()}.webm`;
    fs.writeFileSync(tmpFile, buffer);

    // Whisper / gpt-4o-transcribe aufrufen
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: "gpt-4o-transcribe",
    });

    // tmp-Datei wieder löschen
    fs.unlink(tmpFile, (e) => {
      if (e) console.error("Fehler beim Löschen der tmp-Datei:", e);
    });

    if (!transcription || !transcription.text) {
      return res.json({
        text: "",
        error: "Keine Sprache erkannt – bitte nochmal versuchen.",
      });
    }

    res.json({ text: transcription.text });
  } catch (err) {
    console.error("Whisper Fehler:", err.response?.data || err);
    res.status(500).json({
      error: "Whisper-Fehler – bitte nochmal sprechen oder kürzer formulieren.",
    });
  }
});

// --------------------------------------
// 3) Text-to-Speech /voice
// --------------------------------------
app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Kein Text für TTS übergeben" });
    }

    const profile = profiles[profileId];
    const voice = profile?.voice || "alloy";

    const tts = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      format: "wav",
    });

    const wav = Buffer.from(await tts.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.send(wav);
  } catch (err) {
    console.error("TTS Fehler:", err.response?.data || err);
    res.status(500).json({ error: "TTS-Fehler" });
  }
});

// --------------------------------------
// 4) Feedback /feedback
//    (aktuell: bewertet den übergebenen Text –
//    egal ob letzte Antwort oder ganzes Gespräch)
// --------------------------------------
app.post("/feedback", async (req, res) => {
  try {
    const { transcript, profileId } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "Kein Text für Feedback übergeben" });
    }

    const profile = profiles[profileId];
    const kundenInfo = profile
      ? `Kunde im Training: ${profile.name} (${profile.beschreibung}).`
      : `Kunde: generische Privatperson der AOK NordWest.`;

    const prompt = `
Du bist ein erfahrener Trainer für AOK-Telefonate.

${kundenInfo}

Analysiere die folgende Antwort bzw. den folgenden Gesprächsteil eines Mitarbeiters:

"${transcript}"

Gib ein strukturiertes Feedback:

1. Inhalt & Nutzenargumentation (Was ist gut, was fehlt?)
2. Sprachgeschwindigkeit & Verständlichkeit
3. Tonalität & Empathie (wirkt die Antwort freundlich, wertschätzend, passend zur Situation?)
4. Struktur (roter Faden, klare Botschaft, logischer Aufbau)
5. Redeanteil (wirkt es eher wie ein Monolog oder dialogorientiert?)
6. 3–5 konkrete, praxisnahe Verbesserungsvorschläge (Stichpunkte)
7. Schulnote (1–6) mit kurzer Begründung.

Formuliere kompakt, damit der Mitarbeiter direkt damit arbeiten kann.
    `.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein professioneller Trainer für telefonische Beratungs- und Verkaufsgespräche bei der AOK NordWest.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 700,
    });

    const feedbackText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Es konnte kein Feedback generiert werden.";

    res.json({ feedback: feedbackText });
  } catch (err) {
    console.error("Feedback Fehler:", err.response?.data || err);
    res.status(500).json({ error: "Feedback-Fehler" });
  }
});

// --------------------------------------
// Healthcheck
// --------------------------------------
app.get("/", (_req, res) => {
  res.send("AOK Telefontraining Backend läuft.");
});

app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});
