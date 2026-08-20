import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublishedAlerts, toSiteAlerts } from "./directus";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toSiteAlerts", () => {
  it("keeps labelled published alerts, trims them and orders them by sort", () => {
    expect(
      toSiteAlerts([
        { id: "b", status: "published", label: "  Second alert  ", sort: 2 },
        { id: "a", status: "published", label: "First alert", sort: 1 },
      ]),
    ).toEqual([
      { id: "a", label: "First alert", sort: 1 },
      { id: "b", label: "Second alert", sort: 2 },
    ]);
  });

  it("drops non-published records even if the API ever returns them", () => {
    expect(
      toSiteAlerts([
        { id: "draft", status: "draft", label: "Not ready", sort: 1 },
        { id: "archived", status: "archived", label: "Expired", sort: 2 },
        { id: "live", status: "published", label: "Live", sort: 3 },
      ]),
    ).toEqual([{ id: "live", label: "Live", sort: 3 }]);
  });

  it("drops records without a usable label and places unsorted alerts last", () => {
    expect(
      toSiteAlerts([
        { id: "empty", status: "published", label: "   ", sort: 1 },
        { id: "missing", status: "published", sort: 2 },
        { id: "unsorted", status: "published", label: "No sort value", sort: null },
        { id: "kept", status: "published", label: "Kept", sort: 3 },
      ]),
    ).toEqual([
      { id: "kept", label: "Kept", sort: 3 },
      { id: "unsorted", label: "No sort value", sort: null },
    ]);
  });

  it("returns an empty list for a missing payload", () => {
    expect(toSiteAlerts(undefined)).toEqual([]);
    expect(toSiteAlerts(null)).toEqual([]);
    expect(toSiteAlerts([])).toEqual([]);
  });
});

describe("getPublishedAlerts", () => {
  it("requests only banner fields filtered to published alerts", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(
        JSON.stringify({
          data: [
            { id: 2, status: "published", label: "Later", sort: 2 },
            { id: 1, status: "published", label: "Live", sort: 1 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublishedAlerts()).resolves.toEqual([
      { id: 1, label: "Live", sort: 1 },
      { id: 2, label: "Later", sort: 2 },
    ]);

    const requested = new URL(requestedUrls[0]);
    expect(requested.pathname).toBe("/items/alerts");
    expect(requested.searchParams.get("fields")).toBe("id,status,label,sort");
    expect(JSON.parse(requested.searchParams.get("filter") ?? "{}")).toEqual({
      status: { _eq: "published" },
    });
  });

  it("degrades to no banner when Directus is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );

    await expect(getPublishedAlerts()).resolves.toEqual([]);
  });
});
