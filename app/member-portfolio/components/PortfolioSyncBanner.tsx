import { portfolioSyncStatusMessage } from "@/lib/member-portfolio/constants";
import type { PortfolioSyncState } from "@/lib/member-portfolio/types";

export function PortfolioSyncBanner({ syncState }: { syncState: PortfolioSyncState }) {
  return (
    <p className="member-portfolio__sync" role="status">
      {portfolioSyncStatusMessage(syncState)}
    </p>
  );
}
