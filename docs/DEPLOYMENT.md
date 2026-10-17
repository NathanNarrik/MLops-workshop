# Live deployment: one shared app, many student Codespaces

The recommended flow is **an instructor deploys one shared Render service**, while students train and test in their own Codespaces. Attendees need no Render account. This demonstrates a real hosted URL without making cloud onboarding part of a one-hour lab.

## Option A: Render Docker web service

### Prepare once

1. Push this project to your workshop GitHub repository. Confirm Actions passes on the exact revision you will deploy.
2. Sign in to Render. Choose **New → Blueprint**, connect the repository, and select the workshop branch. Render reads `render.yaml`.
3. Review the single web service. It uses Docker, the free instance type, `/health` as its health check, and `PORT=10000`. Confirm current plan terms and availability in your account before creating it.
4. Create the service. The Docker builder installs dependencies, trains, and applies the accuracy gate. A failed build should not replace the last healthy deployment.
5. Wait for the service to become ready and open its assigned `https://...onrender.com` URL.
6. Verify the full request path:

   ```bash
   python scripts/smoke.py --url https://YOUR-SERVICE.onrender.com
   ```

7. Record the service URL and deployed Git commit in your presenter notes. Leave automatic deploys off for a predictable live session. Do not commit credentials.

If you use **New → Web Service** instead of a Blueprint, choose the Docker runtime, root Dockerfile, health path `/health`, and a suitable instance plan. The server binds `0.0.0.0` and uses Render's `PORT` value.

### Show during the workshop

Have the successful deployment ready beforehand. Trigger **Manual Deploy → Deploy latest commit** on the prepared revision. Show the build log, model evaluation, health check, and service URL. While the build runs, discuss the Dockerfile. Do not make a large code change merely to force a new deployment.

After readiness passes, run the smoke script against the hosted URL. Ask a student to predict a digit on their laptop or phone. Open `/model` and compare the loaded version with the build's artifact version. The Docker build may produce a different byte hash from a local build on a different platform. Compare evaluation and provenance as well as the hash.

For rollback, use the Render service's deployment history to redeploy a known-good commit or use the available rollback action for your plan. Verify `/health`, `/model`, and the smoke script afterward. The release unit is the code, dependencies, and packaged model together. Practice this before the event.

### Constraints to explain

- Render currently spins down free web services after 15 minutes without inbound traffic. A later request must wait for a cold start. Open the app shortly before the demo and allow time for readiness.
- Render free services are demonstrations, not an uptime promise. Plan capabilities and limits can change.
- The model lives inside the image. There is no runtime disk requirement, external secret, or database.
- Demo metrics live in memory. A restart or deployment resets them. Use one worker.
- This public app is intentionally open and uses only public teaching data. There is no production rate limiter. Remove the service after use if you no longer need it.

## Option B: Codespaces public port

Run `bash scripts/start.sh`, open **Ports**, and locate port **8000**. If your organization permits it, change **Port Visibility → Public** and share the forwarded URL. Verify it in a signed-out browser before giving it to the room.

This is the fastest sharing fallback. It demonstrates remote access to a running development process, but it stops serving when the process or Codespace stops. Keep the default private port for individual student work. Some organizations disable public forwarding.

## Option C: Local container

```bash
docker build -t soda-digit-lab:workshop .
docker run --rm -p 8001:8000 soda-digit-lab:workshop
python scripts/smoke.py --url http://localhost:8001
```

This verifies the same packaged runtime without a hosting account. It is not an internet deployment. In Codespaces, forward port 8001 to open the container.

## What remains before event day

The repository includes deployable configuration. Creating the remote GitHub repository, connecting Render, and assigning a public URL require your chosen accounts. No cloud deployment is created by building these local materials.

Official references, checked October 17, 2026: [Render Docker](https://render.com/docs/docker), [web services](https://render.com/docs/web-services), [free services](https://render.com/docs/free), [health checks](https://render.com/docs/health-checks), [deployments](https://render.com/docs/deploys), [Codespaces port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).
