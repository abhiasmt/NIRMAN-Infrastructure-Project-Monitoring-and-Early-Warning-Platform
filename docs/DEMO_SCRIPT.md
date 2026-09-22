# NIRMAN — 5 minute demo script

Keep the browser on `web/index.html` before you start.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Landing page | "Infrastructure monitoring today tells you a project has slipped. NIRMAN tells you which project is about to." |
| 0:30 | Login as `mospi@nirman.demo` | "Six roles, each scoped to what that officer is allowed to see." |
| 0:45 | Overview | "420 projects. The portfolio's risk distribution, and where the high-risk work is concentrated — by sector, ministry and state." |
| 1:30 | Projects → filter Roads & Highways + Assam + High | "An officer starts the week here: what needs attention first." |
| 2:00 | Open NH Corridor Package-3 | "Delay risk 83%, cost-overrun risk 73%, overall 79 out of 100." |
| 2:30 | Risk & explanation tab | "This is the part that matters. Progress is 38.5% against an expected 65%. Revised cost is 24% over sanction. Land acquisition is at 72%. The officer can defend this in a review meeting — it isn't a black-box number." |
| 3:15 | Create intervention | "The officer, not the model, decides. The action is assigned and tracked to closure." |
| 3:45 | Alerts → acknowledge | "Eight rules raise early warnings automatically." |
| 4:15 | Data upload → import CSV | "New return comes in, scores and alerts recalculate." |
| 4:45 | Admin settings | "Thresholds and weights are the ministry's call, not ours — change them and the whole portfolio re-bands." |

**If asked "is this real ML?"** — Two calibrated classifiers, XGBoost with a RandomForest
fallback, trained on engineered features; explanations come from SHAP when available and
from feature importance plus project rules otherwise. `ml-service/models/training_report.json`
has the metrics.

**If asked about the data** — entirely synthetic, generated for the demo. Production needs
authorised PAIMANA/OCMS integration. Say it before they ask.
