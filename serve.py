#!/usr/bin/env python3
"""Serve the Odoo Internals Field Manual from this directory.

Works no matter where you invoke it from:

    python3 serve.py          # http://127.0.0.1:8080
    python3 serve.py 9000     # custom port

The server binds to localhost only. Use a reverse proxy if you need LAN access.
"""
from __future__ import annotations

import functools
import http.server
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)


class DocsServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    port = 9000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])

    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=str(ROOT),
    )
    try:
        httpd = DocsServer(("127.0.0.1", port), handler)
    except OSError as exc:
        if exc.errno == 98:  # EADDRINUSE
            print(f"Port {port} is already in use.")
            print("Stop the other server, or choose another port:")
            print(f"    python3 serve.py {port + 1}")
            raise SystemExit(1) from None
        raise

    with httpd:
        print(f"Odoo Internals Field Manual: http://127.0.0.1:{port}/")
        print(f"Serving: {ROOT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
