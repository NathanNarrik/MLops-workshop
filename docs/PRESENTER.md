# Presenter runbook

**Duration:** 60 minutes. **Start:** 7:30 PM Arizona time. **Room:** PSH 150, ASU Tempe. Date and primary owner remain TBD.

## Before the event

- Publish the repository to the intended GitHub owner and branch. The local project intentionally does not invent a remote URL.
- Confirm student Codespaces access and quota. Open a fresh Codespace and run the full student path. A Codespace prebuild can reduce setup time if your organization supports it.
- Install Space Grotesk on the presenting computer. Open the PowerPoint and rehearse its speaker notes. Test projector readability.
- Run `pytest -q`, `python -m ml.train`, and `python scripts/smoke.py` against a running app.
- Create the Render service using `docs/DEPLOYMENT.md`. Predeploy a known-good revision. Record its URL and commit. Open the URL shortly before presenting, allowing time for a cold start.
- Keep one local or Codespaces copy running as a fallback. Docker is available in the workshop dev container, but initial image pulls can take time.
- Replace the date and RSVP fields in `event/`. Generate the real QR only after there is a real RSVP URL. Test the QR on a phone.
- Have officers help with setup. Pair students who cannot start a Codespace.
- During arrival, help students open their Codespaces so setup can finish while you teach the introduction. Begin the live app demonstration only after the concept slides.

## Timeline and cues

| Time | Topic | Presenter action | Student checkpoint |
|---|---|---|---|
| 7:30–7:45 | Beginner foundations, slides 1–13 | Explain ML and MLOps with the digit example, then discuss the quick check | Explain training, inference, and why operations matter |
| 7:45–7:48 | Demo and setup, slides 14–15 | Predict a sample, then start student apps | App open |
| 7:48–7:57 | Train, slides 16–21 | Walk through the notebook and metadata | Artifact created |
| 7:57–8:06 | Package, slides 22–27 | Explain input rules, API, tests, Docker | Valid and invalid calls |
| 8:06–8:16 | Deploy, slides 28–31 | Show Render build, readiness and public URL | Explain hosting boundary |
| 8:16–8:25 | Monitor, slides 32–35 | Send normal, shifted and invalid traffic | Alert and recovery |
| 8:25–8:30 | Recap and questions | Trace one prediction together | Explain the complete flow |

Slides contain precise talk tracks and command cues. Keep the deck beside the editor rather than reading code from slides.

## Beginner introduction

Teach the first 13 slides before opening the demo. Use the same handwritten-digit example throughout. Define each term before showing the tool that implements it:

- **Model, input, label, prediction:** a learned pattern, an image, its correct digit, and the model's guess.
- **Training and inference:** learning from examples and using the saved model on a new input.
- **MLOps:** the practices a team uses to build, release, and maintain a reliable ML application.
- **Version and artifact:** the identity of a revision and a saved output such as the fitted model.
- **Pipeline and reproducibility:** explicit steps and the information needed to repeat them.
- **API, serving, deployment:** how programs exchange requests, how a model answers them, and how a release becomes available.
- **Monitoring and drift:** observations of the running system and changes in the inputs it receives.
- **CI/CD, retraining, rollback:** automated checks, release preparation, fitting a new candidate, and returning to a working version.

For the quick check, give pairs 30 seconds: a fast but wrong digit prediction could involve the input, preprocessing, model, or app. Ask what evidence they would inspect. Do not equate a fast response with a correct answer. Students do not need to memorize tool names or acronyms.

Keep setup and cloud signup out of the theory block. If time runs short, show the prepared deployment and leave the optional student Docker build for after the workshop. Preserve time for the validation and monitoring exercises.

## Rehearsal sequence

Rehearse the 15-minute introduction first. The numbered sequence below starts at slide 14, after students have the conceptual vocabulary.

1. Start the app. In the UI select the held-out digit 3, click Predict. Explain the version and score.
2. Try a handwritten digit. A wrong answer is useful: discuss dataset mismatch.
3. Open the notebook and run it. Run `python -m ml.train` and inspect `artifacts/metadata.json`.
4. Show `PredictionInput`, then `/docs`. Run `python scripts/smoke.py` in a second terminal.
5. Run `python scripts/traffic.py --mode invalid --count 1`. Show HTTP 422, then the error counter.
6. Show the Docker build stages. Trigger a manual redeploy of the prepared Render service. Narrate repository → build → health check → public URL.
7. Run `python scripts/smoke.py --url https://YOUR-SERVICE.onrender.com`. Show that this is a different host from the Codespace.
8. Have students use their own app for experiments so everyone can see their own metrics. Use the shared deployed app briefly to demonstrate multi-user traffic.
9. Send 30 normal samples, then 30 shifted samples. Explain why the alert does not measure accuracy.
10. Send 100 normal samples to clear the window. Ask what must happen before swapping in a candidate model.

## If something goes wrong

| Symptom | Recovery |
|---|---|
| Codespace setup is unfinished | Use instructor URL and pair students, continue concepts |
| Browser opened `0.0.0.0:8000` | In Codespaces use Ports → 8000 → Open in Browser. Locally use `http://localhost:8000` |
| Port page fails | Confirm server process, port 8000, and that the Codespace is running |
| Port is private for attendees | Use Render, or explicitly change visibility if org policy allows |
| Model missing or mismatched | Stop server, run `python -m ml.train`, restart |
| New model does not appear | Restart server. It loads the artifact once at startup |
| Docker is still pulling | Show Dockerfile and existing hosted app, skip student build |
| Render build or cold start runs long | Switch to the predeployed service or forwarded Codespace |
| Shift alert stays on | Send 100 normal samples to replace the full rolling window |
| Metrics jump unexpectedly | Multiple people share this server. Each student can use their own |
| Metrics reset | Process restarted. Use this to explain durable telemetry |

Do not spend the teaching time on account signup or payment screens. Do not imply that a forwarded port is permanent hosting. The core workshop ends successfully even if the live cloud build is delayed.
