# AquaShield judge access

**Website:** [Open AquaShield](http://3.111.33.20/)

**Municipal/operator login:** [Sign in](http://3.111.33.20/login) · **Citizen login:** [Citizen sign in](http://3.111.33.20/citizen/login) · **Registration:** [Create a citizen account](http://3.111.33.20/register).

## Public judging accounts

These six dedicated accounts were added to the deployed application's MongoDB Atlas database, aquashield, on 11 October 2026. All six hosted login, identity and logout checks passed. MongoDB stores hashed passwords; only these intentionally public judging passwords are published. No Atlas connection string, database password, API key or session token is included.

| Role     | Email                                         | Password                 | Login route    |
| -------- | --------------------------------------------- | ------------------------ | -------------- |
| ADMIN    | judge-admin@aquashield-demo.example.test      | tL7B05-LVhSswCLGzNfPmcn2 | /login         |
| OPERATOR | judge-operator-1@aquashield-demo.example.test | cO4FNRiW4SwLG4lQdm4tLUAz | /login         |
| OPERATOR | judge-operator-2@aquashield-demo.example.test | 5oCsXAqKuoCAuxJ5rJEuG5ll | /login         |
| CITIZEN  | judge-citizen-1@aquashield-demo.example.test  | ojx-oYz7XHj7P7LvNeLE_aHx | /citizen/login |
| CITIZEN  | judge-citizen-2@aquashield-demo.example.test  | JtZfQVEYVhaThxUxRKuuw3zu | /citizen/login |
| CITIZEN  | judge-citizen-3@aquashield-demo.example.test  | xAHKzcaF-YpLjOLecK6dJXvQ | /citizen/login |

Anyone can use these accounts. The administrator has the application's existing ADMIN permissions and can change database records. These are not restricted read-only sessions. Do not reuse these passwords, enter real citizen information during judging, or treat this database as protected by confidential administrator credentials. The website currently uses HTTP; enable HTTPS before using private credentials or real citizen data.

## Test the application

1. Sign in as ADMIN and inspect the dashboard, report review, shortages, tanker management, allocation, delivery history, analytics and audit screens.
2. Both judging operators are available for selection in fleet management. Link an eligible tanker to an operator and follow the normal review, approval and assignment workflow. Account provisioning itself creates no tanker, shortage, allocation or trip.
3. Sign out and sign in as that OPERATOR. Open Your assignments. Delivery controls require an assigned trip and the appropriate trip state. Follow Start trip, Mark arrived, the supported recipient-code verification and recorded-litre completion workflow.
4. Sign out and sign in as a CITIZEN, submit a synthetic household report and inspect My Reports and My Alerts. Newly created accounts initially have no report history. Do not enter real household/contact information.
5. A delivery code is available only to the designated citizen after the appropriate arrival state. Public accounts do not bypass ownership, verification, eligibility or role checks. Production restrictions on simulation/demo OTP remain unchanged.

## Verification scope

All six accounts were verified against the hosted login and identity APIs, and test sessions were logged out. The protected administrator fleet read returned HTTP 200 and listed both judging operators. Additional role-specific reads hit the existing HTTP 429 limiter; they were stopped without retries or security changes. A complete browser allocation/delivery journey was not performed by this provisioning task. Repeated sign-in attempts may be temporarily rate-limited.

Existing accounts and passwords were not overwritten. These hosted judging accounts replace the earlier simulation-only credentials in this document. Separate local simulation setup is described in [the simulation guide](docs/dynamic-simulation.md).
