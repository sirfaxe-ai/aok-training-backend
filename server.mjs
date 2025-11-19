import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

// OpenAI Client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors()); // erlaubt alle Origins, kein ALLOWED_ORIGIN-Fehler mehr
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ----------------------------------------
// Profile mit Name, Nachname, Geschlecht
// ----------------------------------------
const profiles = {
  K1: {
    id: "K1",
    name: "Daniel Koch",
    lastName: "Koch",
    gender: "m",
    description: "38 Jahre, sportlicher Familienvater, Elektriker.",
  },
  K2: {
    id: "K2",
    name: "Jasmin Hoffmann",
    lastName: "Hoffmann",
    gender: "f",
    description: "31 Jahre, alleinerziehend, gestresst, wenig Zeit.",
  },
  K3: {
    id: "K3",
    name: "Horst Meier",
    lastName: "Meier",
    gender: "m",
    description: "72 Jahre, Rentner, ruhiges Temperament, skeptisch.",
  },
  K4: {
    id: "K4",
    name: "Lea Weber",
    lastName: "Weber",
    gender: "f",
    description: "24 Jahre, Berufseinsteigerin, freundlich, offen.",
  },
  K5: {
    id: "K5",
    name: "Mehmet Arslan",
    lastName: "Arslan",
    gender: "m",
    description: "44 Jahre, selbstständig, pragmatisch, knapp angebunden.",
  },
  K6: {
    id: "K6",
    name: "Nadine Krüger",
    lastName: "Krüger",
    gender: "f",
    description: "36 Jahre, Familienmanagerin, oft gehetzt, freundlich.",
  },
  K7: {
    id: "K7",
    name: "Wolfgang Lüders",
    lastName: "Lüders",
    gender: "m",
    description: "68 Jahre, skeptisch, hinterfragt alles.",
  },
  K8: {
    id: "K8",
    name: "Anna Berger",
    lastName: "Berger",
    gender: "f",
    description: "29 Jahre, junge Mutter, vorsichtig, sicherheitsbedacht.",
  },
  K9: {
    id: "K9",
    name: "Christian Falk",
    lastName: "Falk",
    gender: "m",
    description: "42 Jahre, IT-Führungskraft, effizient, will klare Infos.",
  },
  K10: {
    id: "K10",
    name: "Patrick Sommer",
    lastName: "Sommer",
    gender: "m",
    description: "34 Jahre, sehr freundlich, offen, gesprächig.",
  },
};

// ----------------------------------------
// Helper: Systemprompt für Chat
// ----------------------------------------
function buildSystemPrompt(profileId) {
  const profile = profiles[profileId];

  const defaultDesc =
    "Du bist ein realistischer AOK-NordWest-Kunde in einem Telefontraining mit einem Mitarbeiter.";

  if (!profile) {
    return `
${defaultDesc}

WICHTIG:
- Du meldest dich am Telefon wie ein echter Privatkunde: z.B. "Ja?", "Hallo?", "[Nachname]?".
- Keine langen Monologe – 1–2 Sätze.
- Du verhältst dich wie eine ganz normale Privatperson.
- Du nennst keine Fantasienamen wie "Weber" oder Details, die kein echter Kunde sagen würde.
`.trim();
  }

  const greetingExamples =
    profile.gender === "f"
      ? `"Ja, hier ist Frau ${profile.lastName}.", "${profile.lastName}?", "Ja?"`
      : `"Ja, hier ist Herr ${profile.lastName}.", "${profile.lastName}?", "Ja?"`;

  return `
Du bist ${profile.name}, eine real existierende Privatperson im AOK-NordWest-Telefontraining.

Kurzbeschreibung:
${profile.description}

WICHTIG:
- Du meldest dich am Telefon NATÜRLICH mit deinem eigenen Namen.
- Begrüßungsbeispiele (nur Beispiele!): ${greetingExamples}
- Du benutzt IMMER deinen eigenen Nachnamen (${profile.lastName}) und NIEMALS einen anderen Namen.
- KEINE Sätze wie "Hallo, ich bin ${profile.name}, XX Jahre alt. Worum geht's denn?".
- Du antwortest in 1–2 Sätzen, wie ein echter Kunde:
  - manchmal knapp
  - manchmal etwas genervt oder skeptisch
  - manchmal freundlich und offen
- Du bist KEIN Verkäufer, sondern die privat angerufene Person.
- Reagiere inhaltlich passend auf das, was der Mitarbeiter sagt (Rücken, Ernährung, digitale Angebote, Arzt in der Tasche etc.).
`.trim();
}

// ----------------------------------------
// 1) CUSTOMER REPLY (Chat)
// ----------------------------------------
app.post("/chat", async (req, res) => {
  try {
    const { profileId, history } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: "profileId fehlt" });
    }

    const systemPrompt = buildSystemPrompt(profileId);

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
    ];

    if (!history || history.length === 0) {
      // Erster Turn: Kunde hebt ab
      messages.push({
        role: "user",
        content:
          "Der AOK-Mitarbeiter ruft dich gerade an. Du hebst ab und meldest dich so, wie du dich am Telefon üblicherweise meldest.",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";
    res.json({ reply });
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});

// ----------------------------------------
// 2) SPEECH TO TEXT (Whisper / gpt-4o-transcribe)
//    erwartet audioBase64 aus dem Frontend
// ----------------------------------------
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 fehlt" });
    }

    const buffer = Buffer.from(audioBase64, "base64");

    const transcription = await client.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-transcribe",
      response_format: "json",
      // optional: language: "de",
    });

    res.json({ text: transcription.text });
  } catch (err) {
    console.error("Whisper Fehler:", err.response?.data || err);
    res.status(500).json({ error: "Whisper-Fehler" });
  }
});

// ----------------------------------------
// 3) TEXT TO SPEECH (TTS)
//    Männer → "männlich" klingende Stimmen
//    Frauen → "weiblich" klingende Stimmen
// ----------------------------------------
app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text für TTS fehlt" });
    }

    const profile = profiles[profileId];

    // Stimmen-Zuordnung (subjektiv, aber konsistent)
    // männlich wirkend: alloy, sage, onyx, marin, cedar, ash, ballad
    // weiblich wirkend: verse, coral, nova, shimmer, fable
    let voice = "alloy"; // Default

    if (profile?.gender === "f") {
      // Frauen
      voice = "verse";
    } else if (profile?.gender === "m") {
      // Männer
      if (profileId === "K3" || profileId === "K7") {
        // ältere Herren eher ruhige Stimme
        voice = "sage";
      } else {
        voice = "alloy";
      }
    }

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
    console.error("TTS Fehler:", err);
    res.status(500).json({ error: "TTS-Fehler" });
  }
});

// ----------------------------------------
// 4) FEEDBACK – ausführlich & strukturiert
//    aktuell: Feedback zur letzten Antwort
// ----------------------------------------
app.post("/feedback", async (req, res) => {
  try {
    const { transcript, profileId } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "Kein Text für Feedback übergeben" });
    }

    const profile = profiles[profileId];
    const kundenInfo = profile
      ? `Der angenommene Kunde ist ${profile.name} (${profile.description}).`
      : "Der angenommene Kunde ist eine privatversicherte Person bei der AOK NordWest.";

    const prompt = `
Du bist ein sehr erfahrener Trainer für AOK-Telefonate (Beratung & Vertrieb).

${kundenInfo}

Analysiere die folgende (letzte) Antwort des Mitarbeiters in einem Trainingsgespräch:

"${transcript}"

Gib ein ausführliches, aber praxisnahes Feedback auf DEUTSCH in folgender Struktur:

1. Kurzfazit (2–3 Sätze)
2. Inhalt & Nutzenargumentation
   - Wird ein klarer Nutzen für den Kunden erkennbar?
   - Wird der Bezug zu seiner Situation (Profil) hergestellt?
3. Sprache & Tempo
   - Verständlichkeit
   - Satzlänge
   - Tempo (zu schnell/zu langsam/angenehm)
4. Tonalität & Empathie
   - Wirkt die Antwort freundlich, wertschätzend, ruhig?
   - Passt die Tonalität zur Situation und zum Kundentyp?
5. Struktur & Leitfaden
   - Ist erkennbar, wo der Mitarbeiter im Gespräch steht?
   - Gibt es einen roten Faden (z.B. Einstieg, Bedarf, Angebot, Abschluss)?
6. Redeanteil & Fragetechnik
   - Wirkt die Antwort wie ein Monolog oder lässt sie Raum für den Kunden?
   - Werden passende Fragen gestellt (offene Fragen, Verständnisfragen)?
7. Konkrete Verbesserungsvorschläge
   - 5–7 Bulletpoints, sehr konkret und umsetzbar
8. Schulnote (1–6) mit kurzer Begründung

Schreibe so, dass der Mitarbeiter direkt versteht, was er beim nächsten Versuch besser machen kann.
    `.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du bist ein professioneller Trainer für AOK-Telefonate und gibst klares, wertschätzendes und ehrliches Feedback.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });

    const feedbackText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Es konnte kein Feedback generiert werden.";

    res.json({ feedback: feedbackText });
  } catch (err) {
    console.error("Feedback Fehler:", err);
    res.status(500).json({ error: "Feedback-Fehler" });
  }
});

// ----------------------------------------
// Root / Healthcheck
// ----------------------------------------
app.get("/", (req, res) => {
  res.send("AOK Telefontraining Backend läuft.");
});

app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});
