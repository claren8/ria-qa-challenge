# Ria Money Transfer: QA Coding Challenge

E2E tests with **Selenium WebDriver (JavaScript, Chrome)** and API tests with **Postman**, written against https://www.riamoneytransfer.com/ (English site for Chile, `/en-cl/`).

> Everything described under "Findings" is something I observed myself in the browser and in DevTools. Where I am guessing at a cause, I say so.

## Repository contents

| Path | What it is |
|---|---|
| `calculator-spec.js` | The 8 Selenium tests, a small test runner and helper functions |
| `primer-test.js` | My first script, only used to check that Selenium opens the site |
| `screenshots/` | Results of the Selenium run and of the two Postman requests |
| `package.json` | Dependencies (`selenium-webdriver`) |

## How to run

Requirements: Node.js and Google Chrome.

```bash
npm install
node calculator-spec.js
```

Each test opens its own Chrome window, so a full run takes a few minutes. The runner prints a pass or fail line per test. To run only some tests, comment out the other `correrTest(...)` lines at the bottom of the file.

## What the Selenium tests cover

| # | What it checks |
|---|---|
| 1a | The amount field does not accept letters (the value stays free of letters) |
| 1b | An amount above the maximum (11111111) shows the error message and sets `aria-invalid="true"` |
| 2 | The destination selector opens and the country list includes Haiti |
| 3 | Choosing Haiti and then HTG closes the modal and the selector shows HTG |
| 4 | With 25000 CLP to HTG, the converted amount equals 25000 x the rate shown on the page |
| 5 | Changing the amount to 50000 changes the result, and it still matches 50000 x the rate |
| 6 | The calculator button leads to the `secure.riamoneytransfer.com` domain |
| 7 | The `secure` login page shows the email/phone field, the password field and the register link |
| 8 | Clicking the register link goes to `/registration` |

## Findings

### Differences between the challenge text and the site

1. **"Please enter a valid amount" never appeared.** Letters cannot be typed at all: the field stays empty. With other invalid values I saw different messages: `.1` shows "Minimum is 1 CLP" and `11,111,111` shows "Maximum is 10,000,000 CLP". When the field has no error, a screen-reader-only hint says "Enter an amount between 1-10000000 CLP." I did not try pasting letters or inspect the page source for the phrase, so I cannot say it does not exist anywhere. Tests 1a and 1b therefore check the behavior I actually observed.
2. **Labels differ from the challenge.** "Amount" is shown as "You send". "Send to" is shown as "They receive" (its `aria-label` is "Select Destination"). "Get Started" is "Start your transfer" and it is a link (`<a>`), not a button. "Register" is also a link, not a button.
3. **Register does not lead to a country selection page.** From Chile, the flow I saw was: "Start your transfer" opens `secure.riamoneytransfer.com/?_gl=...` (a tracking-looking parameter), which redirects to `/login`. Clicking "Regístrate" opens `/registration` with the message "No se ha podido registrar la cuenta. Según tu ubicación actual, no puedes registrar una cuenta en Chile". "Entendido" sends me back to `www.riamoneytransfer.com/es-cl/`. I also tried a VPN and the site still treated me as being in Chile; I did not investigate further. Test 8 checks that the click reaches `/registration`, and I did not go past that page or enter any data.
4. **The `secure` site was in Spanish** even though I started from the English site. I do not know why.

### Behavior worth a second look

- **The amount parsing depends on the language.** On `en-cl`, comma is the thousands separator and dot is the decimal. Typing `11.111.111` was read as `11`, while `11,111,111` triggered the maximum error.
- **Clearing "You send" keeps the old result.** After deleting the amount, "They receive" and "Total to pay" kept the previous values (3,331.35 and 25,000 CLP). I saw it once and did not check whether it is intended.
- **Dominican Republic appears twice in the full destination list** (USD, and DOP at the end). I did not investigate it.
- **A promotional rate is shown next to a struck-through one** (0.133254 vs 0.13093). The result on screen matches the promotional rate. The promotion may vary between sessions, which is one reason the tests never hardcode a converted amount.
- **Very large amounts show a different error.** Typing digits only: `11111111`, `1000000000` and `2147483647` show "Maximum is 10,000,000 CLP", but 11-digit values such as `10000000000` and `50000000000` show "Unable to get rates. Please try again." instead, in English on a Spanish page, with the rate showing "—". It looks like the maximum validation does not catch very large values before the rates request is made. I did not find the exact cutoff or the cause.

### Things that made the tests unstable, and what I did

| What I saw | What I did |
|---|---|
| `[role="dialog"]` matched two elements with the modal open, so `findElement` could return the wrong one | Narrowed the selector with `data-state="open"` (0 matches with the modal closed, 1 open) |
| The country list first showed 5 countries and the full list appeared a few seconds later; Haiti was not in the first version | Wait for the content I need (Haiti present) instead of reading right after the modal opens |
| After choosing Haiti, the first element with the text `HTG` was not displayed (the previous panel appears to stay in the DOM; this part is my guess) | Wait for the first matching element that is actually displayed, then click it |
| The rate element was re-rendered while typing (`StaleElementReferenceError` and `NoSuchElementError`) | Look the elements up again on every read, and retry inside the wait when one of those two errors appears |
| A cookie consent dialog intercepted the click on the register link (`ElementClickInterceptedError`) | A helper rejects the cookies after reaching `secure` |

## Design decisions

- **Selectors, most to least stable:** `id` when it is meaningful (`amount-from`, `amount-to`, `amount-error`), then attributes like `aria-label` and `analytics-name`, then text only when nothing else exists. I avoided Tailwind classes and ids that look generated (`radix-...`, `v-6-input`). I confirmed each selector with `document.querySelectorAll(...).length` in the console.
- **No hardcoded converted amount.** The rate changes daily, so test 4 reads the rate from the page and checks that `|result - 25000 x rate| < 0.05`. The tolerance comes from rounding: the result shows 2 decimals and the rate 6.
- **Explicit waits on conditions, never fixed sleeps.** Selenium does not wait by itself the way Playwright does.
- **Only digits are typed in amount fields**, so the tests do not depend on the site language.
- **Each test is independent** and opens its own browser, so one test's state cannot affect another.
- **For the `secure` domain I compare the domain or the path, not the full URL**, because the `?_gl=...` part changes on every session.

## Limitations and what I did not cover

- Test 4 checks that the calculator is consistent with itself. It does **not** validate that the exchange rate is correct against an external source.
- The tests depend on a few non-standard attributes (`analytics-name`, `data-state`, the `rate-title` id). If the site changes them, the tests will fail without a real bug.
- I tested the English site (`en-cl`) only. The Spanish version is not covered.
- Test 1a would also pass if typing failed completely, because an empty field has no letters. A positive control (typing digits first and checking that they are accepted) is a pending improvement.
- Test 7 passed while the cookie dialog was covering the page: `isDisplayed()` only says whether an element is visible, not whether something is on top of it.
- The registration flow stops at `/registration`. No account was created and no personal data was entered.
- The runner is my own and basic. A failed test is printed, but the process still ends with exit code 0. In a real project I would use Mocha or Jest for proper reporting and exit codes.

## Postman

Two requests, each with three tests (screenshots in `screenshots/`):

**GET** `https://jsonplaceholder.typicode.com/posts/`
1. The status is 200.
2. All 100 posts have a non-empty `title` and `body` (the test first checks the list is not empty, so it cannot pass on an empty response).
3. No post contains "zombie" (text lowercased first, so "Zombie" would also be caught).

**POST** `https://httpbin.org/post` with the body from the challenge
1. The status is 200 or 201.
2. `topping` is exactly bacon, cheese and mushroom (any order). I chose an exact match because the challenge says the topping *is* those three.
3. `topping` does not contain chicken.

httpbin echoes the request, so the checks read `response.json.topping`. In my run Postman sent the body with `Content-Type: text/plain` and httpbin still parsed it as JSON.

## Open questions for the team

1. Where should "Please enter a valid amount" appear? I could not trigger it.
2. Is the register page meant to show a country selection from Chile, or does the blocking message describe the expected behavior for my location?

## How I used AI

I used Claude as a tutor and pair-programmer. I come from Playwright, so it explained how the same ideas work in Selenium, proposed test skeletons with blanks for me to fill in, and helped me read error output.

- I explored the site by hand with DevTools, chose what to assert, wrote most of the test code, ran everything and decided what each test should prove.
- A few pieces were written by Claude and I reviewed and ran them: the retry-and-pick-the-visible-element wait for HTG, the helpers that read and wait for the conversion, the cookie rejection helper and the body of test 7.
- Some of Claude's predictions were wrong (for example about the exact `href` of the button and about how many `HTG` elements would exist), and I found that by checking against the real page. That is why every selector was confirmed in the console and every claim in "Findings" comes from something I saw myself.
- I ran every test and then deliberately broke it (changing an expected value or a selector) to confirm it fails. Exceptions: the second assert of test 5 (result changed) and the visibility asserts of test 7 were not exercised on their own.

## Screenshots

- `screenshots/selenium-results.png`: the Selenium run with all 8 tests passing
- `screenshots/postman-get.png`: GET request, 3/3 tests passing
- `screenshots/postman-post.png`: POST request, 3/3 tests passing
