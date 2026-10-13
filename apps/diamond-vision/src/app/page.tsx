import { baseball } from "@vision/sport-baseball/descriptor";
import { SportShellHome } from "@vision/ui/components/SportShellHome/SportShellHome";

import { SHELL } from "@/shell";

export default function HomePage() {
  return <SportShellHome sport={baseball} {...SHELL} />;
}
