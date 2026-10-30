# Video script (optional, 90 seconds)

A video isn't required by the rules, but it helps judges who won't click. Beats follow `CLAUDE.md` §11. Numbers match the README, `/present` and `docs/devpost.md`; if one changes, change all of them.

**Record:** on a phone, from the live site. Use `/present` for beats 1, 2 and 4 and the sample page `/g/birthday-with-amma` for beat 3.
**Sound:** voiceover only, with burned-in captions. No music, or royalty-free music only.
**No spinners:** everything shown is a replay, which loads instantly. Don't record a live run.
**Length:** about 210 words of voiceover, which is roughly 85 seconds at a calm pace.

---

## Shot list

| Time | On screen | Screen text (overlay) | Voiceover |
|---|---|---|---|
| 0:00–0:08 | `/present`, chapter 1: the group chat. Scroll slowly through the messages. | **Saturday, 4:10 pm. 40 messages. No plan.** | Saturday afternoon. Four flatmates, one group chat: "Where are we going tonight?" Forty messages later, still no plan. |
| 0:08–0:15 | Keep scrolling to "…32 more messages". | **Someone always ends up organising.** | Someone always ends up organising, and they're guessing what everyone else likes. |
| 0:15–0:22 | Scroll up to the title and the one sentence. | **Common Ground** / *A generic AI guesses what your group might like. Common Ground knows what each of you loves.* | A generic AI guesses what your group might like. Common Ground knows what each of you loves, and finds the place where those tastes overlap. |
| 0:22–0:32 | Chapter 2: the four friends' taste cards. Pause on Amma's card. | **4 friends · 12 tastes · music, TV, food** | Kabir loves Arctic Monkeys and craft beer. Tanvi, The Weeknd and cocktails. Sameer, Linkin Park and chicken wings. And Amma loves M. S. Subbulakshmi and filter coffee. She's vegetarian, and on a budget. |
| 0:32–0:42 | Open `/g/birthday-with-amma`. Show the green WhatsApp-style plan card. | **One place. One reason for each friend.** | An agent matches every taste on Qloo's taste graph, scores each restaurant for each friend, and writes one line per person, ready to paste into the chat. |
| 0:42–0:50 | Tap the **Share to WhatsApp** button, then scroll down. | **Every reason cites Qloo data** | Every reason has to cite evidence that Qloo returned. If it can't, it's marked unverified. |
| 0:50–0:58 | Open the X-ray. Scroll through the Qloo calls and the per-friend score table. | **The X-ray: every Qloo call, every score** | The X-ray shows every Qloo call and each friend's score for each place. The model never produces a number. |
| 0:58–1:08 | `/present`, chapter 3: the averaging vs fairness table. Highlight Tanvi's column. | **Averaging: least happy friend 52 · Fairness: 57** | Averaging would pick the place Sameer loves most, and leave Tanvi with her weakest match. Common Ground picks the place whose least-happy friend is happiest. |
| 1:08–1:18 | Chapter 4: the without-Qloo vs with-Qloo cards, side by side. | **Same model. No Qloo → over Amma's budget.** | Here's the same model with no Qloo. It picks a brewery that's over Amma's budget, with reasons nothing backs up. |
| 1:18–1:25 | Chapter 5: the table with all three groups. | **Least happy friend: 0 without Qloo → 58–81 with it** *(small: measured with Qloo's own model; not yet tested with real groups)* | Across three groups, the least-happy friend goes from zero to between fifty-eight and eighty-one, measured with Qloo's own taste model. |
| 1:25–1:30 | The home page, with the URL visible. | **common-ground-phi-bice.vercel.app** · *No sign-up. Try a sample or your own group.* | Common Ground. Open a sample, or plan for your own group. |

---

## Captions (paste as subtitles)

Same as the voiceover column, one line per row. If you trim the voiceover, keep the captions word for word with what's said.

## Things not to say

- "Real people liked it better." There's no blind check yet; the numbers use Qloo's own model as the yardstick.
- Any figure that isn't in the README: the least-happy scores 52 → 57 and 0 → 58–81, plans in about 11–31 seconds, and 11–22 Qloo calls per plan.
- That the people are real. They're fictional; their tastes went through the real agent and real Qloo data.

## Recording checklist

- [ ] Phone in light mode, Do Not Disturb on, browser chrome tidy (one tab).
- [ ] Load `/present` and `/g/birthday-with-amma` once beforehand so they're cached.
- [ ] Record each beat as its own clip; trim in the editor.
- [ ] Voiceover recorded separately in a quiet room; captions burned in.
- [ ] Export at 1080p vertical (or 16:9 with the phone centred), under 2 minutes.
- [ ] Upload to YouTube (unlisted is fine) and paste the link at the top of the Devpost entry and README.
