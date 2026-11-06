// ARbixo Payroll User Manual, shown at /payroll/manual (app/(app)/payroll/manual).
// Plain markdown: # / ## / ### headings, paragraphs, **bold**, "1." and "-" lists
// and pipe tables. Rendered by components/SimpleMarkdown.tsx.
// Mirrors the Claude Docs copy of the manual; edit here to change the in-app page.

export const PAYROLL_MANUAL_MD = `
ARbixo Payroll computes pay for regular and daily-rate employees, tracks leave, prints payslips and posts the payroll journal to ARbixo Accounting.

## 1. Getting started

Open Payroll from the app launcher after you log in. If your account has only Payroll, you go straight into it. Users with both apps switch with the app button in the top bar.

### The Payroll menu

| Menu item | What it is for |
| --- | --- |
| Dashboard | Employee counts, draft runs, gross paid this year, recent runs, contracts ending in 30 days and setup warnings |
| Timesheets | Encode each employee's daily time in and out; the basis of the payroll run |
| Payroll runs | Create, encode, post and print regular and 13th-month payroll |
| Payroll employees | Each employee's pay details: rate, pay group, shift, rest days, IDs, bank, recurring items |
| Leave | File and approve leave; view and adjust leave balances |
| Payroll setup | Pay rules, work schedule, posting accounts, pay groups, earnings and deductions, leave credits |
| Leave types | Statutory and company leave policies |
| User manual | This page |

Shared pages, such as Master Data › Employees, Branches, Company details and My profile, are available in both apps.

### First-time setup, in order

1. **Company details** must be complete. Payroll pages say "Complete company setup first" until they are.
2. **Employees** exist in Master Data › Employees, or are created by the payroll import (section 4).
3. **Payroll setup**: check the pay rules, set the work schedule and choose the posting accounts (section 2).
4. **Pay groups and pay items**: keep or adjust the two default pay groups; add allowances and deductions you use.
5. **Leave types**: review the default leave types and choose how credits are earned (section 3).
6. **Payroll employees**: give every employee pay details (section 4). The dashboard warns about active employees with none.
7. **Leave credits**: on the Leave page, press **Grant {year} credits** (section 5).
8. **First payroll run** (section 6).

The dashboard shows a yellow banner while posting accounts are missing, employees have no pay details, or leave filings wait for approval. Each line links to the page that fixes it.

## 2. Payroll setup

Payroll setup holds the company-wide rules every run uses. The defaults follow the Labor Code minimums; change them only if company policy pays more. Press **Save setup** after changing pay rules, the work schedule or accounts. The Leave credits switch saves as soon as you tick it.

### Leave credits

**Earn leave credits monthly** is OFF by default. When OFF, a year's credits are available in full from January 1. When ON, employees earn 1/12 of the yearly credits on the 1st of each month: with 12 days a year, they have 1 day on Jan 1, 2 on Feb 1 and 12 on Dec 1. An employee's own setting in Payroll employees overrides this.

### Pay rules

| Setting | Default | Notes |
| --- | --- | --- |
| Salary factor (days per year) | 313 | Converts a monthly salary to a daily rate |
| Hours per day | 8 | Hourly rate = daily rate ÷ hours per day; also used to turn absent hours into days |
| OT, ordinary day | 125% | |
| OT, rest day / special day / holiday | 130% of that day's rate | |
| Night shift differential | +10% | Work from 10 pm to 6 am |
| Rest day worked | 130% | |
| Special day worked | 130% | |
| Special day on rest day | 150% | |
| Double special day | 150% | |
| Double special day on rest day | 195% | |
| Regular holiday worked | 200% | |
| Regular holiday on rest day | 260% | |
| Double regular holiday | 300% | |
| Double holiday on rest day | 390% | |
| Tax-exempt 13th month + bonuses / year | ₱90,000 | |

The checkboxes under Pay rules:

- **Pay daily-rate employees for unworked regular holidays (100%)**: on by default.
- **Holiday pay only if present or on paid leave the workday before**: on by default.
- **Monthly salary already pays special days** and **already pays rest days**: match these to your salary factor (365, 313 or 261).
- **Rest days**: the company's default rest days (Sunday by default). They are skipped when counting leave days.

### Work schedule (biometric import)

The biometric import compares punches with this shift to work out late/undertime, overtime and night hours. Employees can have their own shift in Payroll employees.

| Setting | Default |
| --- | --- |
| Shift start / end | 08:00 to 17:00 (an end at or before the start is an overnight shift) |
| Unpaid break | 60 min |
| Late grace | 0 min |
| Minimum OT counted | 30 min |
| Round OT down to | 15 min |

### Posting accounts

A posted run creates one General Journal entry in ARbixo Accounting using these accounts. Set at least Salaries & wages expense, Net pay and SSS payable before posting.

- Salaries & wages expense (Dr)
- Employer contributions expense (Dr), or "Same as salaries & wages"
- SSS, PhilHealth and Pag-IBIG payable (Cr)
- Withholding tax on compensation payable (Cr)
- Other deductions, default (Cr)
- Net pay: salaries payable or cash (Cr)

### Pay groups

A pay group is a set of employees paid on the same schedule with the same statutory deductions. Every company starts with two:

| Code | Name | Frequency | Deductions |
| --- | --- | --- | --- |
| REG-SM | Regular staff (semi-monthly) | Semi-monthly | SSS, PhilHealth, Pag-IBIG, withholding tax |
| CON-WK | Contractuals (weekly, daily rate) | Weekly | No withholding tax |

Press **+ Add pay group** to add one. Choose a code, name, frequency (monthly, semi-monthly, weekly or daily) and which of SSS, PhilHealth, Pag-IBIG and withholding tax to deduct.

Two extra choices appear for **weekly** and **semi-monthly** groups:

- **Pay week starts on** (weekly only): the weekday your pay week begins, e.g. Monday for Monday to Sunday or Saturday for Saturday to Friday. New runs suggest that week.
- **SSS / PhilHealth / Pag-IBIG are deducted**: *Every run* splits each month's contribution across that month's runs (a weekly run takes about 12/52 of it). *First run of the month only* or *Last run of the month only* takes the whole month's amount on one run and nothing on the others. The run is placed by its pay date: for weekly groups the first run is the one paid on the 1st to 7th and the last run the one paid in the last 7 days of the month; for semi-monthly groups the first run is paid on the 1st to 15th and the last run from the 16th. The whole-month amount is worked out from that run's pay as a monthly equivalent.

### Earnings & deductions

Pay items are allowances, commissions, loans, cash advances and other amounts you add to a run or set as recurring per employee. Press **+ Add pay item** and set:

- **Code, name and type** (Earning or Deduction).
- **Account**: leave as "Use setup default" or pick a GL account.
- **Taxable**: counts in taxable compensation and in SSS and Pag-IBIG salary.
- **Bonus / other benefit**: tax-exempt together with 13th-month pay up to the yearly cap, and not subject to contributions.

### Contributions and tax

The app uses the 2025 tables:

- **SSS**: 15% of the monthly salary credit (₱5,000 to ₱35,000): employee 5%, employer 10%, plus employer EC.
- **PhilHealth**: 5% of basic salary (floor ₱10,000, ceiling ₱100,000), shared equally.
- **Pag-IBIG**: employee 1% or 2%, employer 2%, on salary up to ₱10,000.
- **Withholding tax**: the TRAIN annual table, annualized per run. Minimum wage earners are exempt.

## 3. Leave types

Leave types define each kind of leave: how many days, who can take it, and whether it is paid. Every company starts with the Philippine statutory leaves plus common company leaves. You can edit them, add your own and deactivate any you don't use.

### Default leave types

| Code | Leave | Days | Who | Legal basis |
| --- | --- | --- | --- | --- |
| SIL | Service Incentive Leave | 5 per year, convertible to cash | After 12 months of service | Labor Code Art. 95 |
| VL | Vacation Leave | 5 per year, carry over up to 5, convertible | Regular employees | Company policy |
| SL | Sick Leave | 5 per year, carry over up to 5 | Regular employees | Company policy |
| ML | Maternity Leave | 105 calendar days per event, +15 for solo parents | Female | RA 11210 |
| ML-ALLOC | Allocated Maternity Leave (father) | 7 per event | Male | RA 11210 Sec. 6 |
| PL | Paternity Leave | 7 per event, up to 4 filings | Male | RA 8187 |
| SPL | Parental Leave for Solo Parents | 7 per year | Solo parents after 6 months | RA 8972 as amended by RA 11861 |
| VAWC | Leave for VAWC Victims | 10 per event | Female | RA 9262 Sec. 43 |
| SLW | Special Leave for Women | Up to 60 calendar days per year | Female after 6 months | RA 9710 |
| LWOP | Leave Without Pay | Unlimited, unpaid | All | Company policy |

### Adding or editing a leave type

Press **+ Add leave type**, or **Edit** on a row, and set:

- **Code, name and legal basis**, for example BL, Birthday leave, Company policy.
- **Credits**: days per year, per filing (for one-time events such as maternity), or unlimited.
- **Credits available**: All from January, or Earned monthly (1/12).
- **Max carry-over to next year** and **Extra days for solo parents**.
- **Max days per year** and **Max filings ever**: blank means no limit.
- **For**: all, female or male employees. Also **Months of service required** and **Employment types** (none ticked means all).
- **Options**: With pay, Count calendar days (include rest days), Allow half-day filing, Solo parents only, Unused days convertible to cash, Allow filing beyond the balance, and Active.

### How credits are earned

The app decides between "all on Jan 1" and "earned monthly" in this order:

1. The employee's own **Leave credits** setting in Payroll employees, if set.
2. Otherwise, the company switch **Earn leave credits monthly** in Payroll setup, if ON.
3. Otherwise, the leave type's own **Credits available** setting.

The banner at the top of the Leave types page shows whether the company switch is ON or OFF, with links to change it.

## 4. Payroll employees

An employee can't be paid until they have pay details (a payroll profile). The list shows every employee from Master Data. Filter it by **With payroll profile** or **No payroll profile**, or search by name or code. The Status column reads In payroll, Excluded or Not set up.

### Setting up an employee

Click an employee to open their pay details, fill in the fields below, then press **Save**.

| Field | What to enter |
| --- | --- |
| Employment type | Regular, Probationary, Contractual, Project-based or Casual |
| Pay basis and rate | **Daily rate** (paid for days worked) or **Monthly salary** (fixed pay less absences) |
| Pay group | Decides the pay frequency and which deductions apply |
| Branch | Optional; lets you run payroll per branch |
| Hire / start date, Contract end | Contract end feeds the dashboard's "Contracts ending in 30 days" |
| Minimum wage earner (MWE) | Tick to exempt from withholding tax |
| SSS, PhilHealth, Pag-IBIG no. | Government numbers |
| Sex, Solo parent | Used for leave eligibility (maternity, paternity, solo parent, VAWC) |
| Gets 13th-month pay | Tick for rank-and-file; untick for managerial employees |
| Biometric ID | The user ID on the biometric device; blank matches by employee code |
| Own shift start / end | Blank uses the company shift |
| Rest days | **Fixed** (same weekdays every week) or **Not fixed** (marked on every run) |
| Leave credits | Company setting, Earned monthly, or All on Jan 1 |
| Bank, Bank account no. | For payout reference |
| Include in payroll | Untick to leave the employee out of new runs |

### Recurring earnings and deductions

Under **Recurring earnings & deductions**, press **+ Add recurring item**, pick a pay item and enter the amount. Recurring items are copied into every new run, for example a fixed allowance or a loan amortization. You can still change or remove them per run.

### Importing from Excel

Use this to set up many employees at once.

1. Press **Import from Excel** and download the template.
2. Fill one row per employee, starting at row 2. Delete the two example rows. Each column has a note and, where it applies, a dropdown.
3. Upload the file. The preview lists each row as create, update or skip, with the reason for any skip.
4. Fix any skipped rows if needed, then confirm the import.

Rules the import follows:

- Rows are matched by **Employee Code**. An employee not yet in Master Data is created when Last Name and First Name are filled in.
- For an existing profile, blank cells keep the current value. A new profile needs Employment Type, Pay Basis and Rate.
- **Pay Group** and **Branch** must match an existing code or name exactly. The default pay groups are REG-SM and CON-WK.
- Dates are YYYY-MM-DD or MM/DD/YYYY. Shift times are 24-hour HH:mm, and Shift Start and Shift End must be filled in together.
- Rest Days are weekday names separated by commas, such as Sun or Sat,Sun.
- Recurring items aren't imported; add them per employee.

## 5. Leave

The Leave page has two parts: **Leave filings** for the year, and **Leave balances** for leave types with yearly credits. Approved leave flows into payroll runs automatically.

### Granting the year's credits

At the start of each year, press **Grant {year} credits** under Leave balances. This gives every eligible employee their credits for the year. Employees who already have credits for that year keep them, so it is safe to press again after adding new employees.

To adjust one employee, click their cell in the balances table. You can change **Granted**, **Carried over** and **Adjustment (±)**, then press **Save**.

Each cell reads available / earned. Pending filings are already deducted from available.

### Filing leave

1. Press **+ File leave**.
2. Choose the employee and leave type, then the dates (From and To) and a reason.
3. Tick **Half day** if allowed for that type. Untick any date in the list that isn't a leave day, such as a holiday.
4. Tick **Approve now** to file and approve in one step, or leave it unticked to file as pending.
5. Press **File & approve** (or **File leave**).

The form warns when the employee has no credits for that year yet or the filing exceeds the balance. Filing beyond the balance is blocked unless the leave type allows it.

### Approving, rejecting and cancelling

Pending filings show **Approve** and **Reject** buttons. Approved filings can be cancelled with **Cancel**. Filter the list by status or search by employee. The dashboard counts filings waiting for approval.

### Converting unused leave to cash

For leave types marked convertible, such as SIL, use the convert button in that type's balances column. Enter a date: unused credits for the year are paid at the daily rate in the draft payroll run that covers that date. The filing then shows "Paid in run covering" that period.

## 6. Payroll runs

A payroll run pays one pay group for one period. It starts as a DRAFT you can edit freely. Once POSTED, it creates the General Journal entry and can't be edited. If a posted run is cancelled, its status changes to CANCELLED.

### Timesheets

Payroll > **Timesheets** is where a secretary (or anyone who can post) encodes each employee's day. It has three views:

- **Daily sheet**: pick a date and fill in every employee for that day. Type the time in and time out (08:00, 730 or 5:30 PM). The day (1 or 0.5), late/undertime minutes, overtime hours and night hours (10 pm to 6 am) are worked out from the shift in Payroll setup, or the employee's own shift, with the same rules as the biometric import. You can change any figure afterwards. Choose **Absent** for a no-show, or **Present** with no times for a plain full day. Rest days and approved leave are flagged next to the name.
- **By employee**: pick an employee and a period (this week, last week, 1st to 15th, 16th to end, or any dates) and fill in the whole period at once. **Save & next employee** saves and moves down the list.
- **Summary**: one row per employee with a mark for every date (1, half day, A absent, L leave, ? workday not encoded) and the totals. Click a name to open their sheet.

**Mark the rest present** fills every workday not yet encoded as a present full day, skipping rest days and approved leave, so you only change the exceptions. Press **Save**; changed rows are highlighted until then.

A day with no entry is "not encoded". It is never counted as an absence: only days marked **Absent** are deducted from monthly-paid staff, while daily-rate staff are paid only for **Present** days.

### The run step by step

1. **Create the run.** Press **+ New payroll run**, choose **Regular payroll**, then set the pay group, period from and to, pay date, branch (or All branches) and remarks. Press **Create run**. Active employees in that pay group are added with their recurring items.
2. **Mark holidays.** Under **Holidays in this period**, set each special day or regular holiday from the President's proclamation. A special working day is an ordinary day.
3. **Check rest days.** Fixed rest days fill in from each employee's schedule. Employees with rest days that aren't fixed are highlighted; click their dates to mark rest days.
4. **Check attendance.** A new run starts with each employee's days worked, late, overtime and night hours filled in from their timesheet entries for the period (employees with no entries are left blank). Press **Fill from timesheets** to refresh it, for example after more days were encoded or after you marked holidays or rest days; the register then lists workdays still not encoded, absences and employees with no entries. You can also enter attendance by hand or with the biometric import (below).
5. **Add earnings and deductions** for this run under each employee's **Items**.
6. **Review** the payroll register. Unsaved changes show as a live preview. Press **Save**.
7. **Post.** Press **Post to GL** and confirm.
8. **Print** the payslips and the register.

### Weekly payroll

For companies that pay weekly, make a pay group with frequency **Weekly** (the default CON-WK group is one) and set the week start day. Then:

1. Encode the week's time in **Timesheets**.
2. In **Payroll runs**, create a run for the weekly pay group; the period and pay date suggest the current pay week.
3. Check holidays, press **Fill from timesheets** if needed, add earnings and deductions, review and post as usual.

Daily-rate employees are paid for the days worked that week; monthly-paid employees in a weekly group receive 12/52 of their monthly salary per run. Withholding tax is worked out on the week and annualized over 52 weeks. The app refuses to create a run that overlaps a draft or posted run of the same pay group (and branch), so the same days are not paid twice; delete the draft or cancel the posted run first if you need to redo a week.

### Day codes

| Code | Day type |
| --- | --- |
| Ord | Ordinary day |
| SH | Special (non-working) day |
| 2SH | Double special day |
| RH | Regular holiday |
| 2RH | Double regular holiday |

A holiday on an employee's rest day uses the "+R" rate from Payroll setup.

### Entering attendance

**Daily-rate employees** use the attendance grid: days worked per date, 1 for a full day and 0.5 for a half day. Press **Fill regular days for everyone** to fill all ordinary days, then change the exceptions. Rest days and holidays apply their premium automatically. An unworked regular holiday is paid if the employee was present, or on paid leave, the workday before.

**Monthly-paid employees** are entered in the payroll register, **all in hours**:

| Column | Meaning |
| --- | --- |
| Absent hrs | Hours absent; 8 hours = 1 day at the default hours per day. The cell shows the period's maximum, e.g. "of 88 hrs". |
| Late hrs | Late plus undertime, in hours; 15 minutes = 0.25 |
| OT hrs | Overtime on ordinary days |
| ND hrs | Night hours (10 pm to 6 am) on ordinary days |
| Leave | Approved leave in the period, filled in automatically |

Absent hours above the period's workdays turn red with "max N hrs". Posting then asks for confirmation, because the employee's basic pay would be zero.

Work on rest days and holidays, with overtime and night hours on those dates, goes under **Work by date** in the employee's Items. Press **+ Add date**, then enter Day worked (monthly-paid), OT hrs, Night hrs and Night OT hrs for that date.

### Biometric import

Press **Import biometrics** and choose the export file from your biometric device.

1. Set the file layout: **one punch per row** (date and time in one column, or in two columns) or **one row per day** (time in and time out).
2. Set the date format (Month/Day/Year, Day/Month/Year or Year-Month-Day), whether the first row is a header, and which column holds each value.
3. Review the preview for each employee: device ID, days present, absent hours, late/undertime hours, OT, night hours and night OT. Rows with only one punch are flagged and not counted; fix them in the grid after importing.
4. Apply the import, check the figures, then press **Save**.

The import matches employees by **Biometric ID**, or by employee code when it is blank. It replaces their attendance, absences, late/undertime, OT and night hours in this run. Mark the period's holidays and rest days first so premiums apply.

### What the register shows

For each employee: Basic, Prem/OT/ND, Other earnings, Gross, SSS, PhilHealth, Pag-IBIG, withholding tax, Other deductions and Net pay. Expand a row to see days worked, taxable income, the late/undertime deduction, the employer share, holiday pay and any leave converted to cash. **Totals** are at the bottom.

To add someone left out, use **Add employee from this pay group…**. To drop someone, use **Remove** on their row.

### Posting, deleting and cancelling

- **Post to GL** creates one General Journal entry for the run, using the accounts in Payroll setup. You need posting rights.
- **Delete draft** removes a draft run completely.
- **Cancel run** on a posted run asks for a reason, then reverses its journal entry. You need cancel rights. To redo a cancelled run, create a new one.

## 7. 13th-month pay runs

A 13th-month run pays 1/12 of the basic salary each employee earned in the year, minus any 13th-month pay already paid that year (PD 851). Basic salary comes from posted runs and excludes overtime, premiums, night differential and holiday pay. A mid-year run pays about half; a December run pays the balance. It is due by December 24.

1. Press **+ New payroll run** and choose **13th-month pay**.
2. Pick the pay group, year and pay date, then press **Create run**.
3. Rank-and-file employees ("Gets 13th-month pay" ticked) with posted pay that year are added automatically.
4. Review the columns: Basic salary earned, 13th-month pay, Tax-exempt, Taxable excess, withholding tax and Net.
5. Press **Post to GL**, then print the payslips.

13th-month pay and other bonuses are tax-exempt together up to the yearly cap (₱90,000 by default). Anything above the cap is taxed. 13th-month pay isn't subject to SSS, PhilHealth or Pag-IBIG.

## 8. Payslips

Open a run and press **Payslips** for one payslip per employee, ready to print. Press **Print register** for the whole run on one report.

Each payslip shows:

- **Header**: employee, period and pay date. A draft run's payslip notes that figures can still change until posting.
- **Earnings**: basic pay, holiday pay, rest day / special day / holiday premium, overtime, night differential, other earnings, and late/undertime as a minus. Totals to Gross pay.
- **Deductions**: SSS, PhilHealth, Pag-IBIG, withholding tax and other deductions. Totals to Total deductions.
- **Leave this period**: each approved leave in the period with its dates and days, marked "(without pay)" where it applies.
- **Leave balance as of** the period end: Earned, Used and Remaining for each leave type with yearly credits. A negative remaining shows in red.
- **Net pay**, and a "Received by / date" line for the employee's signature.

13th-month payslips don't include the leave section.

## 9. User access

A platform admin decides which apps each user can open: ARbixo Accounting, ARbixo Payroll, or both.

1. Go to **Admin › Users** and press **Edit** on the user (or create a new user).
2. Under **App access**, tick **ARbixo Accounting**, **ARbixo Payroll**, or both. At least one is required.
3. Save.

The Users list shows each user's access as "Accounting only", "Payroll only" or "Accounting + Payroll". Existing and new users have both apps until changed.

For a user with only one app:

- After login they go straight into their app, and the app switcher is hidden.
- Pages and data of the other app are blocked. Opening one of its pages sends them back to their own app.
- Shared pages stay available: My profile, Company details, Branches and Master Data › Employees.
- A Payroll-only user can still cancel a posted payroll run, including its journal entry.

Platform admins are never restricted.

## 10. Troubleshooting

| You see | Why | What to do |
| --- | --- | --- |
| "Complete company setup first" | Company details are incomplete | Finish Company details |
| "Posting accounts aren't set yet" | Payroll setup has no salaries, net pay or SSS account | Payroll setup › Posting accounts, then Save setup |
| An employee is missing from a new run | No pay details, "Include in payroll" is unticked, or they are in another pay group | Check Payroll employees; add them with "Add employee from this pay group…" |
| Basic pay is zero for a monthly employee | Absent hours are at or above the period's workdays | Correct Absent hrs; the cell shows the maximum |
| "No {type} credits for {year} yet" when filing | The year's credits were not granted | Leave › Grant {year} credits |
| "... already covers part of this period" when creating a run | A draft or posted run of the same pay group and branch overlaps those dates | Open that run, or delete the draft / cancel the posted run first |
| "Fill from timesheets" found nothing | No timesheet entries for these employees in the period | Encode them under Payroll › Timesheets; check the pay group and dates |
| A daily-rate employee is short of pay after filling from timesheets | Some workdays weren't encoded (listed under the header) | Encode or mark those days, then press Fill from timesheets again |
| Biometric rows flagged "only one punch" | The device has a time in without a time out, or the reverse | Fix that date in the attendance grid after importing |
| Biometric employee not matched | The device user ID differs from the employee code | Set Biometric ID in Payroll employees |
| Import row skipped: "Pay group not found" | The code or name doesn't match | Use the exact pay group code, e.g. REG-SM or CON-WK |
| "You don't have access to ARbixo Payroll" | The user's App access excludes Payroll | Ask a platform admin to tick ARbixo Payroll in Admin › Users |
| A posted run has an error | Posted runs can't be edited | Cancel the run with a reason, then create and post a new one |
`;
