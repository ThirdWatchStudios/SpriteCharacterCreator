# F1.3 Wing Connectivity Graph - Stories

### S1.3.1 - Derive Wing Adjacency From Topology

User story:
- As a Terrarium developer, I need wing adjacency derived from the generated hallway/doorway topology so connectivity reflects the real office, not a guess.

Acceptance criteria:
- Adjacency is computed from the generated door/hallway connections between wings.
- Every wing is reachable from every other wing (the graph is connected).
- Adjacency is deterministic for a given template and seed.

Dependencies:
- F1.1.

### S1.3.2 - Emit The Connectivity Graph In office-layout.json

User story:
- As the sim, I need the wing-connectivity graph in `office-layout.json` so I can drive fog-of-war reveal order and wing-to-wing distance.

Acceptance criteria:
- `office-layout.json` includes a wing-connectivity block (edges between wings).
- The representation supports both reveal-order traversal and a distance reading.
- The graph matches the generated topology for the same seed.

Dependencies:
- S1.3.1.
