# Load testing

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) separately; it is not an application dependency.

Run only against a non-production deployment with disposable test accounts:

```powershell
$env:BASE_URL='https://swiftdu-staging.example.com'
$env:COOKIE='your authenticated staging session cookie'
$env:TASKER_ID='staging tasker id'
k6 run tests/load/staging-load.js
```

For an acceptance race, first create one dedicated **test** order, ensure each request has an authenticated staging tasker session, and run:

```powershell
$env:BASE_URL='https://swiftdu-staging.example.com'
$env:TEST_ORDER_ID='test order id'
$env:COOKIE='authenticated staging tasker session cookie'
k6 run tests/load/acceptance-race.js
```

The scripts reject `https://swiftdu.org`; never use a live order for the race.