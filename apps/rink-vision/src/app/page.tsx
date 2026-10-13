import { hockey } from "@vision/sport-hockey/descriptor";
import { SportShellHome } from "@vision/ui/components/SportShellHome/SportShellHome";

import { SHELL } from "@/shell";

export default function HomePage() {
  return <SportShellHome sport={hockey} {...SHELL} />;
}
