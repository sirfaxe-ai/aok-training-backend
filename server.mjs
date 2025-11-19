import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// CORS – einfach global erlauben, damit es keinen Header-Fehler mehr gibt
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ------------------------------------
// Profile: Name, Nachname, Geschlecht
// + kurze Beschreibung (für das Verhalten)
// ------------------------------------
const profiles = {
  K1: {
    name: "Daniel Koch",
    nachname: "Koch",
    gender: "m",
    beschreibung: "38 Jahre, sportlicher Familienvater, Elektriker, viel unterwegs, will fit bleiben."
  },
  K2: {
    name: "Jasmin Hoffmann",
    nachname: "Hoffmann",
    gender: "w",
    beschreibung: "31 Jahre, alleinerziehend, gestresst, wenig Zeit, Kind häufig im Hintergrund."
  },
  K3: {
    name: "Horst Meier",
    nachname: "Meier",
    gender: "m",
    beschreibung: "72 Jahre, Rentner, ruhiges Temperament, eher skeptisch, hat Rückenprobleme."
  },
  K4: {
    name: "Lea Weber",
    nachname: "Weber",
    gender: "w",
    beschreibung: "24 Jahre, Berufseinsteigerin, freundlich, offen, nutzt gerne Apps."
  },
  K5: {
    name: "Mehmet Arslan",
    nachname: "Arslan",
    gender: "m",
    beschreibung: "44 Jahre, selbstständig als Handwerker, pragmatisch, knapp angebunden, wenig Zeit."
  },
  K6: {
    name: "Nadine Krüger",
    nachname: "Krüger",
    gender: "w",
    beschreibung: "36 Jahre, Familienmanagerin mit Kindern, oft gehetzt, grundsätzlich freundlich."
  },
  K7: {
    name: "Wolfgang Lüders",
    nachname: "Lüders",
    gender: "m",
    beschreibung: "68 Jahre, skeptischer Rentner, hinterfragt alles, misstrauisch bei Angeboten."
  },
  K8: {
    name: "Anna Berger",
    nachname: "Berger",
    gender: "w",
    beschreibung: "29 Jahre, junge Mutter, vorsichtig, sicherheitsbedacht, Kind oft in der Nähe."
  },
  K9: {
    name: "Christian Falk",
    nachname: "Falk",
    gender: "m",
    beschreibung: "42 Jahre, IT-Führungskraft, effizient, will klare Infos und Struktur."
  },
  K10: {
    name: "Patrick Sommer",
    nachname: "Sommer",
    gender: "m",
    beschreibung: "34 Jahre, sehr freundlich, offen, eher gesprächig."
  }
};

// Systemprompt dynamisch je Profil
function buildSystemPrompt(profileId) {
  const profile = profiles[profileId];

  const basis =
    profile
      ? `Du heißt ${profile.name} (Nachname: ${profile.nachname}). ${profile.beschreibung}`
      : `Du bist eine echte Privatperson, die von der AOK angerufen wird.`;

  return `
Du bist ein realistischer AOK-NordWest-Kunde im Telefontraining.

${basis}

WICHTIG:
- Du sprichst NIEMALS explizit über dein Profil (kein Alter, kein Beruf aufzählen)!
- Melde dich am Telefon so, wie es zu dir passt, z. B.:
  - "${profile?.nachname || "Nachname"}?"
  - "Ja, hier ist ${profile?.nachname || "der Nachname"}."
  - "Ja, hallo?"
- Benutze IMMER deinen eigenen Nachnamen (${profile?.nachname || "dein Nachname"}), NIEMALS den eines anderen (also z. B. nicht "Weber", wenn du gar nicht so heißt).
- Keine langen Monologe – in der Regel 1–3 Sätze.
- Zeige eine natürliche Stimmung (gestresst, skeptisch, freundlich …) entsprechend deiner Beschreibung.
- Du bist der Kunde, nicht der Verkäufer.
- Antworte passend auf das, was der Mitarbeitende sagt (Rücken, Ernährung, Arzt in der Tasche, Apps usw.).
- Bleib immer in der Rolle dieser Privatperson.

Wenn der Gesprächsverlauf noch leer ist, tue so, als würdest du gerade das Telefon abnehmen und melde dich mit deinem Nachnamen.
  `.trim();
}

/* -------------------------------------------------------
   1) CUSTOMER REPLY (CHAT)
-------------------------------------------------------- */
app.post('/chat', async (req, res) => {
  try {
    const { profileId, history } = req.body;
    const systemPrompt = buildSystemPrompt(profileId);

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (!msg.role || !msg.content) continue;
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content
        });
      }
    } else {
      messages.push({
        role: "user",
        content: "Das Gespräch beginnt jetzt. Du nimmst den Anruf an."
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldigung, da ist etwas schiefgelaufen.";

    res.json({ reply });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});

/* -------------------------------------------------------
   2) SPEECH TO TEXT (Whisper) – aktuell von dir nicht genutzt,
      aber lassen wir drin, falls du wieder umstellst
-------------------------------------------------------- */
app.post("/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 fehlt" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const transcript = await client.audio.transcriptions.create({
      file: audioBuffer,
      model: "whisper-1",
      response_format: "json"
    });

    res.json({ text: transcript.text });

  } catch (err) {
    console.error("Whisper Fehler:", err.response?.data || err);
    res.status(500).json({ error: "Whisper-Fehler" });
  }
});

/* -------------------------------------------------------
   3) TEXT TO SPEECH – passende Stimmen für m/w
-------------------------------------------------------- */

// sinnvolle Zuordnung der Stimmen
const voiceMap = {
  // männlich
  K1: "alloy",
  K3: "sage",
  K5: "onyx",
  K7: "sage",
  K9: "ballad",
  K10: "alloy",

  // weiblich
  K2: "verse",
  K4: "nova",
  K6: "coral",
  K8: "marin"
};

app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    const profile = profiles[profileId];
    const defaultVoice = profile?.gender === "w" ? "nova" : "alloy";
    const voice = voiceMap[profileId] || defaultVoice;

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

    const profile = profiles[profileId];
    const kundenInfo = profile
      ? `Der angenommene Kunde ist ${profile.name}. Kurzbeschreibung: ${profile.beschreibung}.`
      : "Der angenommene Kunde ist eine Privatperson, die von der AOK angerufen wurde.";

    const prompt = `
Gib ein präzises Feedback zu dieser Antwort eines AOK-Telefonmitarbeiters.

${kundenInfo}

Kriterien:
- Tonalität (freundlich, empathisch, ruhig?)
- Geschwindigkeit (zu schnell / zu langsam?)
- Gesprächsführung
- Bedarfsanalyse gut / schlecht?
- Zu viel Monolog?
- Professionelles Wording?
- Verbesserungsvorschläge in 3–5 Bullet Points.
- Schulnote (1–6) mit kurzer Begründung.

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
