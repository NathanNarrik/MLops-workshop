"""Send bounded demo traffic, including deliberately shifted or invalid inputs."""

import argparse
import json
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--mode", choices=["normal", "shifted", "invalid"], default="normal")
    parser.add_argument("--count", type=int, default=30)
    args = parser.parse_args()
    if not 1 <= args.count <= 200:
        parser.error("count must be between 1 and 200")
    base = args.url.rstrip("/")
    with urllib.request.urlopen(base + "/samples", timeout=30) as response:
        samples = json.load(response)
    for i in range(args.count):
        pixels = samples[i % len(samples)]["pixels"]
        if args.mode == "shifted":
            pixels = [min(16, x + 8) for x in pixels]
        if args.mode == "invalid":
            pixels = [99] * 64
        request = urllib.request.Request(
            base + "/predict",
            data=json.dumps({"pixels": pixels}).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                print(i + 1, response.status, json.load(response)["digit"])
        except urllib.error.HTTPError as exc:
            if args.mode != "invalid" or exc.code != 422:
                raise
            print(i + 1, "422 (expected validation rejection)")
        time.sleep(0.1)
    with urllib.request.urlopen(base + "/stats", timeout=30) as response:
        print(json.dumps(json.load(response), indent=2))


if __name__ == "__main__":
    main()
