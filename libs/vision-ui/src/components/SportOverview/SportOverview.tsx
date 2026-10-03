import { type SportDescriptor, type SportKeys } from "@vision/core/sport/types";
import { categoryDef } from "@vision/core/valuation/categories";

import styles from "#ui/components/SportOverview/SportOverview.module.scss";

const formatPoints = (value: number): string => (value > 0 ? `+${value}` : String(value));

// What a sport's fantasy game is made of, read straight from its descriptor:
// the categories each pool competes in, the points table, and the roster.
// Server-safe; the descriptor never crosses to the client.
export const SportOverview = <K extends SportKeys>({ sport }: { sport: SportDescriptor<K> }) => (
  <div className={styles.overview}>
    {sport.pools
      .filter((pool) => pool.categories.length > 0)
      .map((pool) => (
        <section
          key={pool.key}
          className={styles.panel}
          aria-labelledby={`${sport.id}-${pool.key}-categories`}
        >
          <h2 id={`${sport.id}-${pool.key}-categories`} className={styles.title}>
            {sport.pools.length > 1 ? `Scoring categories: ${pool.label}` : "Scoring categories"}
          </h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Better</th>
                </tr>
              </thead>
              <tbody>
                {pool.categories.map((category) => {
                  const def = categoryDef({ sport, category });
                  return (
                    <tr key={category}>
                      <th scope="row">{def.label}</th>
                      <td>{def.fullName}</td>
                      <td>{def.kind === "ratio" ? "Rate" : "Total"}</td>
                      <td>{def.direction === "lower" ? "Lower" : "Higher"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

    <section className={styles.panel} aria-labelledby={`${sport.id}-points`}>
      <h2 id={`${sport.id}-points`} className={styles.title}>
        Points scoring
      </h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col" className={styles.numeric}>
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {sport.points.keys.map((key) => (
              <tr key={key}>
                <th scope="row">{sport.statLabels[key]}</th>
                <td className={styles.numeric}>{formatPoints(sport.points.defaults[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className={styles.panel} aria-labelledby={`${sport.id}-roster`}>
      <h2 id={`${sport.id}-roster`} className={styles.title}>
        Roster slots
      </h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Name</th>
              <th scope="col">Takes</th>
              <th scope="col" className={styles.numeric}>
                Default
              </th>
            </tr>
          </thead>
          <tbody>
            {sport.slots.map((slot) => (
              <tr key={slot.type}>
                <th scope="row">{slot.label}</th>
                <td>{slot.fullName}</td>
                <td>{slot.accepts === "any" ? "Anyone" : slot.accepts.join(", ")}</td>
                <td className={styles.numeric}>{slot.defaultCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>
);
