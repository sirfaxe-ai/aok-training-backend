import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// ----------------------------------------
// 1. Kundentypen (psychologisch geschärft)
// ----------------------------------------

const customerProfiles = {
  K1: {
    name: "Daniel Koch",
    voice: "alloy",
    temperament: "freundlich, bodenständig, leicht gehetzt",
    speed: 1.05,
    description: `
38, verheiratet, 2 Kinder, Elektriker.
Redet normal schnell, oft leicht hektisch.
Sagt oft Dinge wie: "Ja, alles klar", "Ich bin grad etwas im Stress".
Reagiert positiv, wenn es um Familienleistungen geht.
Typische Einwände:
- "Ja, ich hab eigentlich wenig Zeit"
- "Machen wir kurz, ja?"
Redeanteil: mittel.
    `
  },

  K2: {
    name: "Jasmin Hoffmann",
    voice: "nova",
    temperament: "gestresst, freundlich, oft überfordert",
    speed: 1.15,
    description: `
31, alleinerziehend, Schichtdienst.
Spricht schnell, manchmal abgehackt.
Vermeidet lange Erklärungen.
Typische Ausdrücke:
- "Ich muss gleich los"
- "Das ist alles so viel gerade"
- "Können Sie mir das einfach erklären?"
Redeanteil: niedrig.
    `
  },

  K3: {
    name: "Horst Meier",
    voice: "dexter",
    temperament: "ruhig, langsam, skeptisch",
    speed: 0.85,
    description: `
72, Rentner, lebt allein.
Spricht langsam, nachdenklich, misstrauisch.
Stellt viele Rückfragen.
Typische Einwände:
- "Brauche ich das wirklich?"
- "Was kostet das denn?"
- "Ich verstehe das nicht ganz."
Redeanteil: mittel, aber langsam.
    `
  },

  K4: {
    name: "Lea Weber",
    voice: "shimmer",
    temperament: "jung, locker, modern",
    speed: 1.2,
    description: `
24, Berufseinsteigerin.
Spricht schnell, modern, humorvoll.
Typische Worte:
- "Okay, cool"
- "Alles klar"
- "Moment kurz"
Redeanteil: hoch.
    `
  },

  K5: {
    name: "Mehmet Arslan",
    voice: "verse",
    temperament: "direkt, sachlich, wenig Zeit",
    speed: 1.0,
    description: `
44, selbstständig, körperliche Arbeit.
Kurz angebundene Sätze.
Typische Reaktionen:
- "Sagen Sie einfach, worum's geht"
- "Machen wir's kurz"
- "Ich arbeite gerade"
Redeanteil: sehr gering.
    `
  },

  K6: {
    name: "Nadine Krüger",
    voice: "sage",
    temperament: "freundlich, warm, leicht chaotisch",
    speed: 1.05,
    description: `
36, zwei Kinder, Familienmanagerin.
Lebhaft, freundlich, aber ablenkbar.
Typische Sätze:
- "Einen Moment, bitte"
- "Sorry, die Kinder wieder…"
Redeanteil: hoch.
    `
  },

  K7: {
    name: "Wolfgang Lüders",
    voice: "dexter",
    temperament: "skeptisch, leicht genervt",
    speed: 0.9,
    description: `
68, Rentner, misstrauisch gegenüber Anrufen.
Typische Einwände:
- "Ich sag Ihnen gleich, ich kauf nix"
- "Was wollen Sie denn verkaufen?"
- "Ich glaub das alles nicht"
Redeanteil: niedrig.
    `
  },

  K8: {
    name: "Anna Berger",
    voice: "nova",
    temperament: "sanft, unsicher, freundlich",
    speed: 1.0,
    description: `
29, junge Mutter.
Leise, besorgt, freundlich.
Typische Sätze:
- "Ich kenn mich da nicht so aus"
- "Ist das gut für mein Kind?"
Redeanteil: mittel.
    `
  },

  K9: {
    name: "Christian Falk",
    voice: "verse",
    temperament: "effizient, sachlich, keine Zeit",
    speed: 1.15,
    description: `
42, IT-Führungskraft.
Sehr direkt, erkennt Füllsätze.
Hasst Zeitverschwendung.
Typisch:
- "Bitte auf den Punkt"
- "Fassen Sie sich kurz"
Redeanteil: gering.
    `
  },

  K10: {
    name: "Patrick Sommer",
    voice: "shimmer",
    temperament: "locker, humorvoll, freundlich",
    speed: 1.1,
    description: `
34, guter Typ, entspannt.
Typische Sätze:
- "Kein Stress"
- "Alles easy"
Redeanteil: hoch.
    `
  }
};

// ----------------------------------------
// 2. Chat – mit starken Profilen
// ----------------------------------------

app.post("/chat", async (req, res) => {
  try {
    const { profileId, history } = req.body;

    const profile = customerProfiles[profileId];

    const systemPrompt = `
Du bist ein realer Privatkunde am Telefon.
Verhalte dich exakt nach folgendem Profil:

Name: ${profile.name}
Temperament: ${profile.temperament}
Sprechgeschwindigkeit: ${profile.speed}
Profilbeschreibung:
${profile.description}

REGELN:
- Kein Alter nennen.
- Keine vollständigen persönlichen Daten.
- Rede wie echte Menschen (Pausen, ähs, kurze Sätze).
- Verwende die Wortwahl & Geschwindigkeit aus dem Profil.
- Keine KI-Floskeln.
- Reagiere emotional passend.
- Lass die Telefonkraft reden, wenn sie spricht.
- Keine ellenlangen Antworten.

Begrüßung NUR wie echte Menschen:
- "Ja, ${profile.name.split(" ")[1]}?"
- "${profile.name.split(" ")[0]}?"
- "Ja bitte?"

KEIN:
"Worum geht's?"
"Möchten Sie verkaufen?"
"Ich bin eine KI."
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || [])
    ];

    if (!history || history.length === 0) {
      messages.push({
        role: "user",
        content: "Starte das Gespräch wie ein echter Kunde."
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.85
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Entschuldigung, ich hab das nicht verstanden.";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat-Fehler" });
  }
});

// ----------------------------------------
// 3. TTS – Stimme + Tempo + Tonlage
// ----------------------------------------

app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;
    const profile = customerProfiles[profileId];

    const audioResponse = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: profile.voice,
      input: text,
      speed: profile.speed
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length
    });

    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "TTS-Fehler" });
  }
});

// ----------------------------------------
// 4. Bewertung / Feedback-Funktion
// ----------------------------------------

app.post("/feedback", async (req, res) => {
  try {
    const { transcript, profileId } = req.body;
    const profile = customerProfiles[profileId];

    const prompt = `
Du bist professioneller AOK-Telefontrainer.

Bewerte die Antwort des Telefonisten in diesen Punkten:

1. Einstieg & Gesprächsführung  
2. Empathie & Tonfall  
3. Fragetechnik  
4. Eingehen auf das Profil (${profile.name})  
5. Redeanteil-Verteilung  
6. Professionalität  
7. Verbesserungstipps (konkret!)

Antwort klar strukturiert.
Hier ist die Antwort des Mitarbeiters:

"${transcript}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ feedback: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Feedback-Fehler" });
  }
});

// ----------------------------------------

app.listen(port, () => {
  console.log("Server läuft auf Port", port);
});
