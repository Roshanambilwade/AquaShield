# AquaShield demo access

**Website:** [Open AquaShield](http://3.111.33.20/)

**Municipal/operator login:** [Sign in](http://3.111.33.20/login) · **Citizen login:** [Citizen sign in](http://3.111.33.20/citizen/login) · **Citizen registration:** [Create an account](http://3.111.33.20/register).

The project owner provided this AWS address. Availability and account login have not been independently verified. This address uses HTTP; use only synthetic demo information and enable HTTPS before using private credentials or real citizen records.

These intentionally public accounts are for the synthetic aquashield_simulation_atlas demonstration database. Do not reuse these passwords for other accounts or environments. Anyone using the administrator/operator accounts can perform their permitted actions and change demo records.

## Login accounts

| Role     | Email                                         | Password                         | Login route    |
| -------- | --------------------------------------------- | -------------------------------- | -------------- |
| ADMIN    | admin@aquashield-simulation.example.test      | WQy2UD96ouns32FwLr89yZHs8NefG-ZS | /login         |
| OPERATOR | operator-1@aquashield-simulation.example.test | 4ppPofHS1bA9HeGT2cCiRtEbJwfoZJXu | /login         |
| CITIZEN  | citizen-1@aquashield-simulation.example.test  | G5hvgWaAMW0fClH54zks8Tq0qthq05Us | /citizen/login |

## Where these accounts work

They work only when the running application uses the database containing these accounts. Their access on the AWS deployment has not been verified, and a deployed application using another database will not recognize them. The existing production restrictions on simulation remain in place.

In the prepared local workspace, start the isolated Atlas simulation with:

```powershell
node .local/atlas-simulation.mjs dev
```

That launcher is private workspace tooling and is not included in a repository clone. For portable setup, follow [the dynamic simulation guide](docs/dynamic-simulation.md); a new preparation generates its own accounts and passwords.

## Judge walkthrough

1. Sign in as ADMIN and inspect the dashboard, reports, shortages and allocation screens. Assign an eligible tanker/trip to the listed operator to prepare delivery testing.
2. Sign out, sign in as OPERATOR and open Your assignments to test the assigned trip and the supported demo verification/completion workflow.
3. Sign out, sign in as CITIZEN and submit a report, inspect My Reports and view My Alerts. Public citizen registration is also available.
4. Keep synthetic demo operations separate from real citizen records. These accounts do not establish real identity, physical deliveries or AWS availability.
