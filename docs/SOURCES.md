# Sources and attribution

Technical sources checked October 17, 2026. Platform behavior can change before the event.

- User-supplied `Vibecode to Production-Grade_ Big Tech's AI Development Process.pptx`: original SoDA slide masters, grid background, pink/blue header, logo, and Space Grotesk typography. Old workshop URLs and QR codes are not reused as MLOps registration links.
- [scikit-learn load_digits](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_digits.html): 1,797 samples, 64 features, ten classes, integer pixels from 0 to 16.
- [UCI Optical Recognition of Handwritten Digits](https://archive.ics.uci.edu/dataset/80/optical+recognition+of+handwritten+digits): original dataset and attribution, E. Alpaydin and C. Kaynak.
- [scikit-learn common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html): consistent preprocessing and avoiding data leakage with pipelines.
- [scikit-learn model persistence](https://scikit-learn.org/stable/model_persistence.html): trusted artifacts and compatible dependency versions.
- [SVC scores and probabilities](https://scikit-learn.org/1.6/modules/svm.html#scores-probabilities): probability estimates can disagree with `predict()`. Evaluation and serving in this repository both choose the highest-probability class.
- [FastAPI request bodies](https://fastapi.tiangolo.com/tutorial/body/): Pydantic request models and validation.
- [Prometheus metric types](https://prometheus.io/docs/concepts/metric_types/): counters and histograms.
- [Render Docker](https://render.com/docs/docker), [Blueprint spec](https://render.com/docs/blueprint-spec), [free service behavior](https://render.com/docs/free), [health checks](https://render.com/docs/health-checks).
- [GitHub Codespaces port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace), [Codespaces lifecycle](https://docs.github.com/en/codespaces/about-codespaces/deep-dive).
- [Space Grotesk](https://github.com/floriankarsten/space-grotesk), SIL Open Font License. The locally served font keeps the demo usable without a font CDN.
- [Google Cloud MLOps overview](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning): lifecycle practices, pipelines, and CI/CD distinctions in the beginner introduction.
- [Azure MLOps architecture](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/machine-learning-operations-v2): tracking code, data, and model versions.
- [Azure model monitoring concepts](https://learn.microsoft.com/en-us/azure/machine-learning/concept-model-monitoring): input drift, model quality, and monitoring signals. The workshop examples and discussion questions are original teaching material.

All reported evaluation results come from executing this repository's training code. The brightness threshold is an explicitly chosen classroom heuristic.
