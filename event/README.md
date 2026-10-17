# SoDA event assets

`SoDA-MLOps-Event.png` is a 1080 × 1350 Instagram-ready **draft**, using the supplied SoDA logo and theme. The event date and RSVP are explicitly TBD. No invented registration link or QR code is included.

`event.html` is the editable design source. `preview.html` contains the current date/RSVP copy. The HTML references the original theme assets in `slides/assets/` and the bundled font in `app/static/`.

When the date and real RSVP URL are ready:

```bash
python -m pip install -r event/requirements.txt
python event/configure.py --date "November 5, 2026" --rsvp "https://YOUR-REAL-RSVP-URL"
```

The example date is illustrative, not an announced event date. The script writes `preview.html` and a real `rsvp-qr.png` locally. Open the HTML in a browser to review it. Export the 1080 × 1350 poster to PNG with a browser screenshot. Test the QR on a phone before publishing. If the URL is long, prefer an organizer-controlled short RSVP URL for the visible copy.

## Instagram caption

Take your ML projects beyond the notebook! 🚀

Join SoDA for an MLOps workshop exploring how to package, deploy, and monitor a machine learning model.

📅 Date TBD  
⏰ 7:30 PM Arizona time  
📍 PSH 150, ASU Tempe

Bring your laptop and a friend. RSVP link coming soon!

Replace the date and final line before publishing. Primary owner is TBD. Nothing has been posted or registered by these local assets.
