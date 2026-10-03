import { z } from "zod";

const nbaResultSetSchema = z.object({
  name: z.string(),
  headers: z.array(z.string()),
  rowSet: z.array(z.array(z.unknown())),
});

const nbaResponseSchema = z.object({
  resultSets: z.array(nbaResultSetSchema),
});

export type NbaResultSet = z.infer<typeof nbaResultSetSchema>;
export type NbaResponse = z.infer<typeof nbaResponseSchema>;

export function parseNbaResponse(raw: unknown): NbaResponse {
  return nbaResponseSchema.parse(raw);
}

export function selectResultSet(response: NbaResponse, name: string): NbaResultSet {
  const match = response.resultSets.find((set) => set.name === name);
  if (!match) {
    throw new Error(`NBA result set not found: ${name}`);
  }
  return match;
}

export function rowsToObjects(resultSet: NbaResultSet): Record<string, unknown>[] {
  return resultSet.rowSet.map((row) =>
    Object.fromEntries(resultSet.headers.map((header, index) => [header, row[index]])),
  );
}
