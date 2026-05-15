# BMW / Finance Application Dashboard Artifacts

Version: v1
Generation method: direct-dtctl
Generated at: 2026-05-12T11:20:25.992Z

Files:
- dashboard-v1.json
- metadata-v1.json

Deployment:
- Dashboard name: BMW - Finance Application
- Dashboard ID: bizobs-bmw-finance-application
- Dashboard URL: /ui/apps/dynatrace.dashboards/dashboard/bizobs-bmw-finance-application

dtctl apply:
```bash
dtctl apply -f "dashboards/generated/bmw/finance-application/dashboard-v1.json" --id "bizobs-bmw-finance-application"
```
