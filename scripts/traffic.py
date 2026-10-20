"""Send bounded demo traffic, including deliberately shifted or invalid inputs."""

import argparse
import json
import time
import urllib.error
import urllib.request

from demo_output import show_request, show_response


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
    correct = 0
    if args.mode == "shifted":
        print("DATA DRIFT DEMO: add 8 to every pixel, capped at 16 (camera overexposure).")
        print("The known digit stays the same. HTTP success does not prove correctness.")
    for i in range(args.count):
        sample = samples[i % len(samples)]
        pixels = sample["pixels"]
        if args.mode == "shifted":
            pixels = [min(16, x + 8) for x in pixels]
        if args.mode == "invalid":
            pixels = [99, *pixels[1:]]
        print(f"\n--- Request {i + 1}/{args.count}: {args.mode} ---")
        show_request(base, sample["pixels"], pixels, sample["label"])
        request = urllib.request.Request(
            base + "/predict",
            data=json.dumps({"pixels": pixels}).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = json.load(response)
                show_response(response.status, body)
                if args.mode == "invalid":
                    raise AssertionError("Expected invalid input to return 422")
                matches = body["digit"] == sample["label"]
                correct += int(matches)
                print(
                    f"Known label {sample['label']}; predicted {body['digit']}: "
                    f"{'CORRECT' if matches else 'WRONG (but HTTP succeeded)'}"
                )
        except urllib.error.HTTPError as exc:
            if args.mode != "invalid" or exc.code != 422:
                raise
            show_response(exc.code, json.load(exc))
            print(
                "pixels[0] = 99 exceeds 16. Rejected BEFORE inference; "
                "predictions did not increase."
            )
        time.sleep(0.1)
    with urllib.request.urlopen(base + "/stats", timeout=30) as response:
        print(f"\nGET {base}/stats (read-only monitoring)")
        print(json.dumps(json.load(response), indent=2))
    if args.mode != "invalid":
        print(f"Demo outcomes: {correct}/{args.count} correct on repeated labeled examples.")
        print("This is not a fresh accuracy benchmark. Production accuracy needs true labels.")
    print("Open the app's request inspector / error log to inspect these same request IDs.")


if __name__ == "__main__":
    main()
