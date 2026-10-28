# Vendored frontend dependencies

The web UI is offline-first; these files are checked in so `index.html` works from `file://` and from a local HTTP server without CDN access.

| File | Project | Version | License |
|---|---|---|---|
| `marked.min.js` | [marked](https://github.com/markedjs/marked) | 12.0.2 | MIT |
| `mermaid.min.js` | [Mermaid](https://github.com/mermaid-js/mermaid) | 10.9.1 | MIT |

They are used only to render Markdown and Mermaid diagrams in the documentation browser. No telemetry, no network calls.
