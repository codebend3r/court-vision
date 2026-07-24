import { SeasonSelect } from "court-vision";

const SEASONS = ["2024-25", "2023-24", "2022-23", "2021-22", "2020-21"] as const;

export const Default = () => <SeasonSelect seasons={SEASONS} value="2024-25" />;

export const EarlierSeason = () => <SeasonSelect seasons={SEASONS} value="2022-23" />;
