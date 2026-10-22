/* Crée une fiche dans la base « Clients » (OLA - Operations) de Notion
   quand quelqu'un envoie le formulaire d'embarquement.

   Variables d'environnement Vercel :
   - NOTION_TOKEN        token de l'intégration Notion (connectée à la base Clients)
   - NOTION_TEMPLATE_ID  (optionnel) modèle à appliquer, par défaut « Template Client » */

const DATA_SOURCE_ID = "238ffffd-7882-80fe-8310-000bb8c3ab27"; // Clients
const DEFAULT_TEMPLATE_ID = "238ffffd-7882-8040-8b46-e466e0fa0183"; // Template Client

// Libellés des réponses, dans l'ordre où elles apparaissent dans « Notes »
const LABELS = [
  ["telephone", "Téléphone"],
  ["courriel", "Courriel"],
  ["equipe", "En équipe"],
  ["nb_courtiers", "Nombre de courtiers"],
  ["membres", "Membres"],
  ["adresse", "Adresse"],
  ["ville", "Ville"],
  ["code_postal", "Code postal"],
  ["facture_nom", "Nom sur la facture"],
  ["facture_courriel", "Courriel pour la facture"],
  ["objectif", "Objectif principal"],
  ["cause", "Ce qui bloque"],
  ["probleme", "Problème #1 à régler"],
  ["solutions", "Autres solutions essayées"],
  ["solutions_pourquoi", "Pourquoi ça n'a pas marché"],
  ["base_donnees", "Base de données actuelle"],
  ["systeme_suivi", "Système de suivi"]
];

const clean = v => String(v ?? "").trim().slice(0, 2000);

// Notion limite chaque bloc de texte à 2000 caractères
const richText = text => {
  const parts = [];
  for (let i = 0; i < text.length && parts.length < 100; i += 2000) {
    parts.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return parts;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non permise" });
  if (!process.env.NOTION_TOKEN) return res.status(500).json({ error: "NOTION_TOKEN manquant" });

  let d = req.body || {};
  if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = {}; } }

  const nom = `${clean(d.prenom)} ${clean(d.nom)}`.trim();
  if (!nom || !clean(d.courriel)) return res.status(400).json({ error: "Nom et courriel requis" });

  const notes = LABELS
    .filter(([k]) => clean(d[k]))
    .map(([k, label]) => `${label} : ${clean(d[k])}`)
    .join("\n");

  const r = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
      template: { type: "template_id", template_id: process.env.NOTION_TEMPLATE_ID || DEFAULT_TEMPLATE_ID },
      properties: {
        "Noms": { title: [{ type: "text", text: { content: nom } }] },
        "Statut": { status: { name: "Onboarding" } },
        "Date d'embarquement": { date: { start: today() } },
        "Notes": { rich_text: richText(notes) }
      }
    })
  });

  const out = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("Erreur Notion", r.status, out);
    return res.status(502).json({ error: "Notion a refusé la fiche" });
  }
  return res.status(200).json({ ok: true, url: out.url });
};
