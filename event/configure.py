"""Fill event copy and optionally generate a QR for a real RSVP address."""

import argparse
import html
from pathlib import Path
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default="Date TBD")
    parser.add_argument("--rsvp")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    rsvp = "RSVP link coming soon"
    qr = ""
    if args.rsvp:
        parsed = urlparse(args.rsvp)
        if parsed.scheme != "https" or not parsed.netloc:
            parser.error("Use a real HTTPS RSVP URL")
        import qrcode

        qrcode.make(args.rsvp).save(root / "rsvp-qr.png")
        safe_url = html.escape(args.rsvp, quote=True)
        rsvp = f'<a href="{safe_url}">RSVP: {safe_url}</a>'
        qr = '<img class="qr" src="rsvp-qr.png" alt="Scan to RSVP">'
    content = (root / "event.html").read_text(encoding="utf-8")
    content = content.replace("{{DATE}}", html.escape(args.date))
    content = content.replace("{{RSVP}}", rsvp).replace("{{QR}}", qr)
    (root / "preview.html").write_text(content, encoding="utf-8")
    print("Wrote event/preview.html. Review and export before publishing.")


if __name__ == "__main__":
    main()
