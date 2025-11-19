import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

// OpenAI-Client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS für alle Domains (Home Assistant Web-App)
app.use(cors());
app.use(express.json());

// Profilbeschreibungen für die KI-Chatlogik
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
  K10: "Patrick Sommer (34), sehr freundlicher Typ, offen, interessiert an Gesundheit."
};

// Stimmen für TTS pro Profil
const voiceProfiles = {
  K1:  { voice: "alloy"   }, // neutral männlich
  K2:  { voice: "nova"    }, // jung weiblich
  K3:  { voice: "dexter"  }, // älter männlich
  K4:  { voice: "shimmer" }, // jung/dynamisch
  K5:  { voice: "verse"   }, // erwachsen, sachlich
  K6:  { voice: "sage"    }, // warm, freundlich
  K7:  { voice: "dexter"  }, // älter, skeptisch
  K8:  { voice: "nova"    }, // junge Mutter
  K9:  { voice: "verse"   }, // sachlich, direkt
  K10: { voice: "shimmer" }  // locker, freundlich
};

// Healthcheck
app.get("/", (req, res) => {
  res.send("AOK Telefontraining Backend läuft.");
});

// CHAT ROUTE – erzeugt Textantwort
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
Du bist ein KUNDE der AOK NordWest.
Du sprichst realistisch, in kurzen natürlichen Sätzen.
Du bist keine KI. Sprich wie ein echter Mensch.

Profil:
${profilText}

Wenn das Gespräch startet, melde dich wie ein echter Kunde am Telefon:
z.B. "Ja hallo, hier ist ${profilText.split(",")[0]}, worum geht‘s denn?"
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || [])
    ];

    // Kunde beginnt das Gespräch, wenn keine History vorliegt
    if (!history || history.length === 0) {
      messages.push({
        role: "user",
        content: "Starte das Gespräch wie ein echter Kunde."
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Entschuldigung, ich habe dich gerade nicht verstanden.";

    res.json({ reply });

  } catch (err) {
    console.error("Fehler in /chat:", err);
    res.status(500).json({
      error: "Fehler bei der KI-Antwort",
      details: String(err)
    });
  }
});

// TTS ROUTE – erzeugt NUR Audio (ohne Anweisungen!)
app.post("/voice", async (req, res) => {
  try {
    const { text, profileId } = req.body;

    if (!text || !profileId) {
      return res.status(400).json({ error: "Text oder profileId fehlt" });
    }

    const vp = voiceProfiles[profileId] || voiceProfiles["K1"];

    const audioResponse = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: vp.voice,  // Stimme je nach Profil
      input: text        // Nur der Kundentext! Keine Anweisungen.
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length
    });

    res.send(buffer);

  } catch (err) {
    console.error("Fehler in /voice:", err);
    res.status(500).json({
      error: "TTS fehlgeschlagen",
      details: String(err)
    });
  }
});

// Serverstart
app.listen(port, () => {
  console.log(`Backend läuft auf Port ${port}`);
});

