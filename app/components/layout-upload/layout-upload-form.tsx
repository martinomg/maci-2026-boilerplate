"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileWarning, UploadCloud } from "lucide-react";
import { MatchReport } from "@/components/layout-upload/match-report";
import type { LayoutMatchReport, LayoutUploadResponse } from "@/components/layout-upload/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_SVG_BYTES } from "@/lib/svg-validate";

type Stage = "idle" | "checking" | "reviewing" | "publishing" | "done";

export function LayoutUploadForm({
  lotId,
  lotName,
  currentFileId,
}: {
  lotId: string;
  lotName: string;
  currentFileId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [report, setReport] = useState<LayoutMatchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newFileId, setNewFileId] = useState<string | null>(null);

  // Release the last object URL when the form goes away.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function selectFile(next: File | null) {
    // The preview is rendered through <img>, which never executes scripts
    // inside an SVG; the authoritative checks still run on the server.
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewUrlRef.current);
    setFile(next);
    setReport(null);
    setError(null);
    setNewFileId(null);
    setStage("idle");
  }

  async function send(confirm: boolean) {
    if (!file) {
      setError("Choose an SVG layout file first.");
      return;
    }

    setError(null);
    setStage(confirm ? "publishing" : "checking");

    const body = new FormData();
    body.append("file", file);
    body.append("confirm", confirm ? "true" : "false");

    try {
      const response = await fetch(`/api/lots/${encodeURIComponent(lotId)}/layout`, {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as LayoutUploadResponse;

      if (!payload.ok) {
        setError(payload.message);
        setStage(confirm ? "reviewing" : "idle");
        return;
      }

      setReport(payload.report);
      if (payload.stage === "uploaded") {
        setNewFileId(payload.fileId);
        setStage("done");
      } else {
        setStage("reviewing");
      }
    } catch {
      setError("The upload could not be sent. Check that the application can reach Directus.");
      setStage(confirm ? "reviewing" : "idle");
    }
  }

  const busy = stage === "checking" || stage === "publishing";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a layout file</CardTitle>
          <CardDescription>
            SVG only, up to {(MAX_SVG_BYTES / (1024 * 1024)).toFixed(0)} MB. Scripts, event
            handlers and embedded HTML are rejected before anything reaches Directus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={inputRef}
            type="file"
            accept=".svg,image/svg+xml"
            aria-label="SVG layout file"
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />

          {file ? (
            <p className="text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => send(false)} disabled={!file || busy}>
              <UploadCloud />
              {stage === "checking" ? "Checking…" : "Check file"}
            </Button>
            {stage === "reviewing" || stage === "publishing" ? (
              <Button variant="secondary" onClick={() => send(true)} disabled={busy}>
                {stage === "publishing" ? "Publishing…" : "Confirm and replace layout"}
              </Button>
            ) : null}
            {file ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  selectFile(null);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <FileWarning className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          {stage === "done" && newFileId ? (
            <p className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                Layout replaced for {lotName}. New file id{" "}
                <code className="font-mono text-xs">{newFileId}</code>
                {currentFileId ? (
                  <>
                    , replacing <code className="font-mono text-xs">{currentFileId}</code>
                  </>
                ) : null}
                .
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Preview and spot report</CardTitle>
          <CardDescription>
            The report compares the ids drawn in the file with this lot&apos;s
            <code className="mx-1 font-mono text-xs">svg_element_id</code> values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewUrl ? (
            <div className="overflow-hidden rounded-lg border bg-muted/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`Preview of the layout for ${lotName}`}
                className="mx-auto max-h-72 w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a file to preview it here before publishing.
            </p>
          )}

          {report ? (
            <MatchReport report={report} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Run <span className="font-medium">Check file</span> to see how many spots the layout
              covers.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
