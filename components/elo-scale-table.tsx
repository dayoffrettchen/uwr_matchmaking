const ELO_SCALE = [
  { rating: "700", label: "Einsteiger", description: "Lernt Position, Raumaufteilung und Wechselrhythmus noch kennen." },
  { rating: "800", label: "Unterer Vereinsbereich", description: "Kann einfache Aufgaben stabil übernehmen, braucht aber noch klare Führung." },
  { rating: "900", label: "Solider Freizeitspieler", description: "Versteht die Grundrolle und ist in normalen Trainingssituationen verlässlich." },
  { rating: "1000", label: "Median-Spieler", description: "Referenzwert für einen typischen Spieler im Kader." },
  { rating: "1100", label: "Überdurchschnittlich", description: "Gewinnt viele direkte Duelle und verbessert die Linie spürbar." },
  { rating: "1200", label: "Starker Vereinsspieler", description: "Trägt Teams, erkennt Spielsituationen früh und stabilisiert andere." },
  { rating: "1300+", label: "Top-Spieler", description: "Sehr hoher Einfluss auf Ergebnis, Struktur und Tempo des Spiels." },
]

export function EloScaleTable() {
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Elo-Werte</h2>
        <p className="text-sm text-muted-foreground">
          Orientierung für Start- und manuelle Ratings. 1000 ist der Median-Spieler.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Rating</th>
              <th className="p-2 text-left">Einordnung</th>
              <th className="p-2 text-left">Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            {ELO_SCALE.map((row) => (
              <tr key={row.rating} className="border-t">
                <td className="p-2 font-medium">{row.rating}</td>
                <td className="p-2">{row.label}</td>
                <td className="p-2 text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
