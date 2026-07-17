import { redirect } from "next/navigation"
import { AppNavigation } from "@/components/app-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSessionUser } from "@/lib/auth/server"
import { getLocale } from "@/lib/i18n-server"
import { buildMatchmakingHelpTables, MATCHMAKING_PRIORITY_ORDER, type HelpTable } from "@/lib/matchmaking/help-tables"

export const dynamic = "force-dynamic"

const content = {
  de: {
    title: "Hilfe: faire Einteilung",
    intro: "So teilt UWR Matchmaking die angemeldeten Spielerinnen und Spieler in zwei möglichst faire Trainings-Teams ein.",
    sectionDescription: "Regeln und Bewertung der automatischen Team-Einteilung.",
    numbersTitle: "Zahlen und Formeln auf einen Blick",
    numbersDescription: "Diese Werte werden bei der automatischen Einteilung verwendet. MMR-Werte, interne Präferenzpunkte und technische Suchgrenzen sind getrennt dargestellt.",
    priorityIntro: "Der Optimierer vergleicht Aufstellungen in dieser Reihenfolge; interne Diagnosegewichte werden hier bewusst nicht als MMR oder einfache Endpunktzahl dargestellt:",
    eloNote: "Die spätere Änderung der persönlichen MMR nach einem eingetragenen Spielergebnis verwendet eine separate Berechnung und ist nicht Bestandteil dieser Einteilungsformeln.",
    sections: [
      { title: "1. Wer wird eingeteilt?", items: ["Alle Anmeldungen für das Training werden genau einmal berücksichtigt.", "Ein Profil gibt vor, welche Positionen eine Person spielen darf: Torwart, Verteidiger und/oder Stürmer.", "Wenn ausnahmsweise keine Position freigeschaltet ist, kann die Person nur provisorisch auf allen Positionen eingeplant werden; die Einteilung zeigt dann eine Warnung."] },
      { title: "2. Ziel-Aufstellung im Wasser", items: ["Ein komplettes aktives Team besteht aus sechs Personen: zwei Torwarte, zwei Verteidiger und zwei Stürmer.", "Diese sechs Plätze sind eigenständige Wechsel-Slots. Jede besetzte Gruppe hat genau eine startende Person im Wasser.", "Bei weniger Anmeldungen oder fehlenden Positionsfreigaben wählt das System die beste machbare Zielverteilung, ohne Personen auf unzulässige Positionen zu setzen."] },
      { title: "3. Ersatzspieler und Wechselgruppen", items: ["Zusätzliche Personen auf derselben Position werden als Wechselspieler in einen der beiden Positions-Slots einsortiert.", "Die Wechselgruppen werden so aufgebaut, dass die Gruppengrößen und die Ratings innerhalb einer Position möglichst ausgewogen bleiben.", "Die Rotation startet mit der ersten Person der Gruppe; weitere Gruppenmitglieder wechseln der Reihe nach ein."] },
      { title: "4. Was bedeutet „fair“?", items: ["Das System bewertet viele mögliche Einteilungen und vergleicht zuerst harte Regeln: gültige Positionen, jede Anmeldung genau einmal, Teamgrößen höchstens um eins unterschiedlich und maximal sechs aktive Personen pro Team.", "Danach versucht es, die effektive Teamstärke anzugleichen. Dafür zählen die Positionsratings, die Startaufstellung und die Stärke der Wechselgruppen.", "Auch die Stärken je Position werden verglichen, damit zum Beispiel nicht ein Team deutlich stärkere Torwarte und das andere deutlich stärkere Stürmer bekommt.", "Positionswünsche werden berücksichtigt: Hauptpositionen sind bevorzugt, Nebenpositionen sind möglich, nicht freigeschaltete Positionen sind tabu.", "Unsichere oder noch wenig gespielte Ratings werden möglichst gleichmäßig auf beide Teams verteilt."] },
      { title: "5. Warum ist das Ergebnis reproduzierbar?", items: ["Bei gleicher normalisierter Teilnehmerliste und gleichem Startwert entsteht dieselbe Einteilung.", "Die Einteilung, die bewertet wird, ist dieselbe Struktur, die anschließend angezeigt und gespeichert wird: Team, Position, Wechselgruppe, Reihenfolge und Start im Wasser.", "Wenn eine perfekte 2/2/2-Aufstellung nicht möglich ist, wird das nicht versteckt, sondern als Best-Effort mit Warnhinweis behandelt."] },
    ],
  },
  en: {
    title: "Help: fair assignment",
    intro: "How UWR Matchmaking assigns signed-up players to two training teams as fairly as possible.",
    sectionDescription: "Rules and scoring of the automatic team assignment.",
    numbersTitle: "Numbers and formulas at a glance",
    numbersDescription: "These values are used by automatic assignment. MMR values, internal preference points and technical search limits are shown separately.",
    priorityIntro: "The optimizer compares lineups in this order; internal diagnostic weights are intentionally not shown as MMR or a simple final score:",
    eloNote: "The later change to personal MMR after a recorded match result uses a separate calculation and is not part of these assignment formulas.",
    sections: [
      { title: "1. Who is assigned?", items: ["Every signup is used exactly once.", "Profiles define eligible positions: goalkeeper, defender and/or forward.", "If no position is enabled, the player can only be assigned provisionally and the result shows a warning."] },
      { title: "2. Target lineup in the water", items: ["A complete active team has six players: two goalkeepers, two defenders and two forwards.", "Those six places are independent rotation slots. Every populated group has exactly one starter in the water.", "With fewer signups or limited eligibility, the system chooses the best feasible target without using ineligible positions."] },
      { title: "3. Substitutes and rotations", items: ["Additional players on the same position become substitutes in one of the two position slots.", "Rotation groups are built to keep group sizes and ratings within a position balanced.", "The first member starts; the other members rotate in order."] },
      { title: "4. What does fair mean?", items: ["The system evaluates many possible assignments and first compares hard rules: valid positions, every signup once, team sizes differing by at most one and at most six active players per team.", "Then it balances effective team strength using position ratings, starters and rotation-group strength.", "Position strengths are compared too, so one team should not get all stronger goalkeepers while the other gets stronger forwards.", "Position preferences matter: main positions are preferred, secondary positions are allowed, ineligible positions are forbidden.", "Uncertain or less established ratings are spread as evenly as possible."] },
      { title: "5. Why is the result reproducible?", items: ["The same normalized input and seed produce the same assignment.", "The structure that is scored is the same structure that is displayed and saved: team, position, rotation group, order and starter status.", "If a perfect 2/2/2 lineup is impossible, that is handled as best-effort with a warning instead of being hidden."] },
    ],
  },
}

function NumbersTable({ table }: { table: HelpTable }) {
  const hasMeaning = table.headings.length === 3
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{table.title}</h3>
      {table.note && <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{table.note}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {table.headings.map((heading) => <th key={heading} scope="col" className="px-3 py-2 font-semibold text-foreground">{heading}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">{row.label}</th>
                <td className="px-3 py-2 text-muted-foreground">{row.valueIsFormula ? <code className="rounded bg-muted px-1 py-0.5 text-foreground">{row.value}</code> : row.value}</td>
                {hasMeaning && <td className="px-3 py-2 text-muted-foreground">{row.meaning}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.after && <p className="text-sm leading-6 text-muted-foreground">{table.after}</p>}
    </section>
  )
}

export default async function HelpPage() {
  const locale = await getLocale()
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  const t = content[locale]
  const tables = buildMatchmakingHelpTables(locale)

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
      <AppNavigation role={user.role} locale={locale} />
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>{t.numbersTitle}</CardTitle>
          <CardDescription>{t.numbersDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {tables.map((table) => <NumbersTable key={table.id} table={table} />)}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{t.priorityIntro}</p>
            <ol className="grid list-decimal gap-1 pl-5 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              {MATCHMAKING_PRIORITY_ORDER[locale].map((item) => <li key={item}>{item}</li>)}
            </ol>
            <p className="pt-2 text-sm leading-6 text-muted-foreground">{t.eloNote}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {t.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{t.sectionDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
