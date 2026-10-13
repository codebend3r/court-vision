import { football } from "@vision/sport-football/descriptor";
import { SportShellHome } from "@vision/ui/components/SportShellHome/SportShellHome";

import { SHELL } from "@/shell";

export default function HomePage() {
  return <SportShellHome sport={football} {...SHELL} />;
}
