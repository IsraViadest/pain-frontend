import cors from "cors";
import express from "express";
import { MOCK_LAYERS } from "../mock/layers";
import type { PainPoint, PainSubmission } from "../src/types/api";
import { loadPainRepoPoints } from "./loadPainPoints";

const PORT = Number(process.env.PAIN_API_PORT ?? 3847);

const PAIN_DATA_TREE =
  "https://github.com/7Magic7Mike7/pain/tree/main/data";

const staticPoints = loadPainRepoPoints();
let userPoints: PainPoint[] = [];

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "256kb" }));

app.get("/api/map/layers", (_req, res) => {
  res.json({ layers: MOCK_LAYERS });
});

app.get("/api/map/points", (req, res) => {
  const layer =
    typeof req.query.layer === "string" && req.query.layer.length > 0
      ? req.query.layer
      : undefined;
  const pick = (p: PainPoint) => !layer || p.uiLayer === layer;
  const points = [...userPoints.filter(pick), ...staticPoints.filter(pick)];
  res.json({ points });
});

app.post("/api/pain-submission", (req, res) => {
  /** Accept legacy `element` from older dev clients until removed. */
  const body = req.body as Partial<PainSubmission> & { element?: string };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const type = body.type;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng must be numbers" });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "lat/lng out of range" });
    return;
  }
  if (!type || typeof type !== "string") {
    res.status(400).json({ error: "type is required" });
    return;
  }

  const point: PainPoint = {
    id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lat,
    lng,
    intensity:
      body.intensity === undefined
        ? 0.5
        : Math.min(1, Math.max(0, Number(body.intensity))),
    uiLayer: type,
    datatype:
      typeof body.datatype === "string"
        ? body.datatype
        : typeof body.element === "string"
          ? body.element
          : undefined,
    text: typeof body.text === "string" ? body.text : undefined,
    createdAt: new Date().toISOString(),
  };

  if (!Number.isFinite(point.intensity)) {
    point.intensity = 0.5;
  }

  userPoints = [point, ...userPoints];
  res.status(201).json({ point });
});

app.listen(PORT, () => {
  console.log(`PAIN mock API http://127.0.0.1:${PORT}`);
  console.log(
    `[pain data] ${staticPoints.length} static point(s) from ${PAIN_DATA_TREE}`,
  );
});
