import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

// OpenAI-Client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS – einfach & robust (alle Origins erlaubt)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// Profile (Name, Geschlecht, Beschreibung)
// ----------------------------------------------------
const profiles = {
  K1: {
    fullName: 'Daniel Koch',
    gender: 'm',
    description: '38 Jahre, sportlicher Familienvater, Elektriker, viel unterwegs.',
  },
  K2: {
    fullName: 'Jasmin Hoffmann',
    gender: 'f',
    description: '31 Jahre, alleinerziehend, gestresst, wenig Zeit, aber gesundheitsbewusst.',
  },
  K3: {
    fullName: 'Horst Meier',
    gender: 'm',
    description: '72 Jahre, Rentner mit Rückenproblemen, eher ruhig, leicht skeptisch.',
  },
  K4: {
    fullName: 'Lea Weber',
    gender: 'f',
    description: '24 Jahre, Berufseinsteigerin, freundlich, offen, digitalaffin.',
  },
  K5: {
    fullName: 'Mehmet Arslan',
    gender: 'm',
    description: '44 Jahre, selbstständiger Handwerker, pragmatisch, knapp angebunden.',
  },
  K6: {
    fullName: 'Nadine Krüger',
    gender: 'f',
    description: '36 Jahre, Familienmanagerin, viel Stress, grundsätzlich freundlich.',
  },
  K7: {
    fullName: 'Wolfgang Lüders',
    gender: 'm',
    description: '68 Jahre, skeptischer Rentner, hinterfragt Angebote kritisch.',
  },
  K8: {
    fullName: 'Anna Berger',
    gender: 'f',
    description: '29 Jahre, junge Mutter, müde, sicherheitsbedacht, achtet auf Familie.',
  },
  K9: {
    fullName: 'Christian Falk',
    gender: 'm',
    description: '42 Jahre, IT-Führungskraft, effizient, stellt konkrete Fragen.',
  },
  K10: {
    fullName: 'Patrick Sommer',
    gender: 'm',
    description: '34 Jahre, sehr freundlich, offen, gesprächig.',
  },
};

// Stimmzuordnung – nur erlaubte Voices, passend zu m/f/älter
const voiceMap = {
  K1: 'alloy',   // Daniel – männlich, neutral
  K2: 'verse',   // Jasmin – weiblich
  K3: 'sage',    // Horst – ältere, ruhigere Stimme
  K4: 'verse',   // Lea – weiblich
  K5: 'ash',     // Mehmet – männlich, etwas kerniger
  K6: 'coral',   // Nadine – weiblich
  K7: 'sage',    // Wolfgang – älter, skeptisch
  K8: 'shimmer', // Anna – weiblich, etwas heller
  K9: 'echo',    // Christian – männlich, klar
  K10: 'marin',  // Patrick – männlich, freundlich
};

// Helper: Nachname aus fullName holen
function getLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// ----------------------------------------------------
// 1) CUSTOMER REPLY (Chat)
// ----------------------------------------------------
app.post('/chat', async (req, res) => {
  try {
    const { profileId, history } = req.body;
    const profile = profiles[profileId] || null;

    const fullName = profile?.fullName || 'Unbekannter Kunde';
    const lastName = getLastName(fullName);
    const description = profile?.description || 'Keine weiteren Details bekannt.';

    const systemPrompt = `
Du bist eine reale Privatperson in einem AOK NordWest Telefontraining.

Name: ${fullName}
Nachname: ${lastName}
Profil: ${description}

WICHTIG:
- Du bist der KUNDE, nicht der Mitarbeiter.
- Du sprichst NIEMALS explizit über dein Profil oder deine Beschreibung.
- Du meldest dich am Telefon ganz normal, z.B.:
  - "Ja?"
  - "Ja, hallo?"
  - "${lastName} hier."
  - "Ja, ${lastName}?"
- Verwende nur deinen eigenen Nachnamen (${lastName}), wenn du dich mit Namen meldest.
- KEINE Sätze wie: "Ich bin ${fullName}, X Jahre alt, worum geht's denn?"
- Antworte kurz und realistisch: meist 1–3 Sätze.
- Reagiere passend auf das, was der Mitarbeiter sagt (Rücken, Ernährung, Arzt in der Tasche, Apps usw.).
- Du bist mal genervt, mal freundlich, mal skeptisch – passend zu deinem Profil, aber immer glaubwürdig.
- Gib niemals Infos preis, die kein echter Kunde am Telefon nennen würde (z. B. "Ich bin eine KI" oder "mein Profil ist ...").
    `.trim();

    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (!msg || !msg.role || !msg.content) continue;
        // Rollen aus dem Frontend: "user" und "assistant"
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    } else {
      // Kein Verlauf – Gespräch beginnt
      messages.push({
        role: 'user',
        content: 'Das ist der Moment, in dem das Telefon klingelt und du dran gehst.',
      });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'Entschuldigung, da ist etwas schiefgelaufen.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat Error:', err);
    res.status(500).json({ error: 'Chat-Fehler' });
  }
});

// ----------------------------------------------------
// 2) SPEECH TO TEXT – Whisper (gpt-4o-transcribe)
// (falls du es später wieder nutzt – aktuell macht dein
//  Frontend Browser-STT, aber wir lassen es drin)
// ----------------------------------------------------
app.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 fehlt' });
    }

    const buffer = Buffer.from(audioBase64, 'base64');

    const transcription = await client.audio.transcriptions.create({
      file: buffer,
      model: 'gpt-4o-transcribe',
      response_format: 'json',
    });

    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Fehler:', err.response?.data || err);
    res.status(500).json({ error: 'Whisper-Fehler' });
  }
});

// ----------------------------------------------------
// 3) TEXT TO SPEECH – passende Stimmen pro Profil
// ----------------------------------------------------
app.post('/voice', async (req, res) => {
  try {
    const { text, profileId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Kein Text für TTS übergeben.' });
    }

    const voice = voiceMap[profileId] || 'alloy';

    const tts = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format: 'wav',
    });

    const wav = Buffer.from(await tts.arrayBuffer());
    res.setHeader('Content-Type', 'audio/wav');
    res.send(wav);
  } catch (err) {
    console.error('TTS Fehler:', err);
    res.status(500).json({ error: 'TTS-Fehler' });
  }
});

// ----------------------------------------------------
// 4) FEEDBACK – ausführlicher Trainerbericht
//    (aktuell auf letzte Antwort, kann aber auch
//     ganze Konversation verarbeiten, wenn du sie schickst)
// ----------------------------------------------------
app.post('/feedback', async (req, res) => {
  try {
    const { transcript, conversation, profileId } = req.body;

    // Falls du später mal den ganzen Verlauf schicken willst:
    const textBasis = conversation || transcript;

    if (!textBasis || !textBasis.trim()) {
      return res.status(400).json({ error: 'Kein Text für Feedback übergeben.' });
    }

    const profile = profiles[profileId];
    const kundenInfo = profile
      ? `Angenommener Kunde: ${profile.fullName}. Kurzprofil: ${profile.description}.`
      : 'Angenommener Kunde: Privatperson der AOK NordWest.';

    const prompt = `
Du bist ein erfahrener Trainer für AOK-Telefonate (Beratung & Verkauf).
Analysiere folgende Antwort bzw. diesen Gesprächsauszug eines Mitarbeiters.

${kundenInfo}

Text des Mitarbeiters / Gesprächsauszug:
"${textBasis}"

Erstelle ein strukturiertes, praxisnahes Feedback auf Deutsch:

1. Kurz-Zusammenfassung (1–2 Sätze)
2. Inhalt & Nutzenargumentation
3. Sprachgeschwindigkeit & Verständlichkeit
4. Tonalität & Empathie (passt sie zur Kundensituation?)
5. Gesprächsführung & Struktur (roter Faden, Leitfadenorientierung, Fragen vs. Monolog)
6. Redeanteil (wirkt der Mitarbeiter eher monologisierend oder dialogorientiert?)
7. Konkrete Verbesserungsvorschläge (5–7 Bullet Points, sehr praktisch formuliert)
8. Schulnote (1–6) mit kurzer Begründung

Sei ehrlich, aber konstruktiv. Schreib so, dass der Mitarbeiter daraus direkt lernen kann.
    `.trim();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein professioneller Trainer für telefonische Beratungs- und Verkaufsgespräche der AOK NordWest.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 700,
    });

    const feedbackText =
      completion.choices?.[0]?.message?.content?.trim() || 'Es konnte kein Feedback generiert werden.';

    res.json({ feedback: feedbackText });
  } catch (err) {
    console.error('Feedback Fehler:', err);
    res.status(500).json({ error: 'Feedback-Fehler' });
  }
});

// ----------------------------------------------------
// 5) Root / Healthcheck
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.send('AOK Telefontraining Backend läuft.');
});

app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});
