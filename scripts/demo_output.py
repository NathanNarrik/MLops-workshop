"""Readable, dependency-free request previews for the live workshop."""

import json


def image_rows(pixels):
    # Two characters per pixel keep the 8x8 preview roughly square in a terminal.
    shades = " .:-=+*#%@"
    return [
        "".join(
            "!!" if not 0 <= v <= 16 else shades[round(v / 16 * 9)] * 2
            for v in pixels[row : row + 8]
        )
        for row in range(0, 64, 8)
    ]


def show_request(url, original, pixels, label):
    print(f"\nKnown label: {label} (for comparison only; NOT sent to the API)")
    print("Original image       Sent image (!! = invalid pixel)")
    for left, right in zip(image_rows(original), image_rows(pixels)):
        print(f"|{left}|   |{right}|")
    print(f"POST {url}/predict\nContent-Type: application/json")
    print(json.dumps({"pixels": pixels}))


def show_response(status, body):
    print(f"HTTP {status}\n{json.dumps(body, indent=2)}")
