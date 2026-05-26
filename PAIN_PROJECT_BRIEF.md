# PAIN Project — Frontend & 3D System Brief (for Cursor)

## Project Context

You are assisting in rebuilding the **PAIN Project (PPP Map)** web platform.

This is an **interactive data visualization system**, not a conventional website.

Core idea:
> Visualize planetary and human pain as a shared, interconnected system through an interactive 3D Earth.

---

## Existing System (Important)

The current implementation uses:
- Three.js (WebGL rendering)
- Texture-based data visualization
- Precomputed datasets (Python + pandas)
- Minimal backend communication

Key observation:
> Pain data is already encoded into textures and mapped onto a sphere.

---

## Core Interface

The main interface is a **3D globe**, which functions as:

- a visualization surface
- a navigation system
- a storytelling device

This is NOT decorative — it is the product.

---

## Data Model (Conceptual)

Pain exists across multiple layers:

- Environmental
- Physical / Physiological
- Emotional
- Socio-economic

Each layer is:

- geographically distributed
- visually encoded (color, texture, intensity)
- potentially sonified

---

## System Architecture

### 1. Data Pipeline (DO NOT MODIFY)

Handled externally (Python):

- dataset processing
- normalization
- mapping to pain categories
- texture generation
- embeddings / AI analysis

Frontend should NOT replicate this logic.

---

### 2. Backend (Node.js API)

Assume backend provides:

- processed datasets
- map points (user submissions)
- submission endpoint
- optional live updates

Example API shape:

GET `/api/map/layers`
GET `/api/map/points`
POST `/api/pain-submission`

Each point may look like:

```json
{
  "id": "123",
  "lat": 48.2,
  "lng": 16.37,
  "type": "emotional",
  "intensity": 0.7,
  "datatype": "water",
  "text": "optional",
  "createdAt": "timestamp"
}
```
