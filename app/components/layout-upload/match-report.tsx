import { Badge } from "@/components/ui/badge";
import type { LayoutMatchReport } from "@/components/layout-upload/types";

function IdList({ ids, limit = 12 }: { ids: string[]; limit?: number }) {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, limit);
  const rest = ids.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((id) => (
        <code
          key={id}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
        >
          {id}
        </code>
      ))}
      {rest > 0 ? (
        <span className="text-[0.7rem] text-muted-foreground">and {rest} more</span>
      ) : null}
    </div>
  );
}

/**
 * Pre-confirm summary: which `parking_spots.svg_element_id` values the uploaded
 * layout actually draws, and which ids the file would leave unrendered.
 */
export function MatchReport({ report }: { report: LayoutMatchReport }) {
  const complete = report.missing.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={complete ? "default" : "secondary"}>
          {report.matched.length} matched
        </Badge>
        <Badge variant={complete ? "outline" : "destructive"}>
          {report.missing.length} missing
        </Badge>
        <Badge variant="outline">{report.unmatched.length} extra ids in file</Badge>
        <span className="text-xs text-muted-foreground">
          {report.mappedSpotCount} of {report.spotCount} spots have an element id
        </span>
      </div>

      {report.missing.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            These spot ids are not drawn in the uploaded file
          </p>
          <IdList ids={report.missing} />
          <p className="text-xs text-muted-foreground">
            You can still publish this layout; those spots will not be highlighted by the viewer.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Every mapped spot of this lot is drawn in the uploaded file.
        </p>
      )}

      {report.unmatched.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Ids in the file without a matching spot</p>
          <IdList ids={report.unmatched} />
        </div>
      ) : null}
    </div>
  );
}
