// ─────────────────────────────────────────────────────────────────────────────
// 20 real meme formats with per-format text zones.
//
// Each format defines:
//   - dimensions of the source image (so we know the canvas to paint)
//   - "zones": named text slots with positions (as fractions of image
//     w/h), max box size, alignment, and style. The agentic caption
//     generator fills these slots; the renderer paints them in place.
//   - "exampleCaptions": at least 5 baked-in teacher captions per format.
//     They double as a fallback when the LLM is unavailable AND as
//     few-shot examples for the prompt.
//
// Style keys recognized by the renderer:
//   - "caption":     Anton Regular 400, ALL CAPS, white fill + heavy black stroke.
//                    Sits on top of photography (default).
//   - "dark-on-light": Anton, original case, black fill, no stroke.
//                    Used for Drake / Expanding Brain panels where the
//                    background is already a flat cream color.
//   - "mocking":     Anton, mIxEd cAsE, black fill, no stroke.
//   - "sign":        Anton, ALL CAPS, dark fill on cream sign.
//   - "doge":        Comic Sans MS, lowercase, colored fill, thin black stroke.
// ─────────────────────────────────────────────────────────────────────────────

const FILE_BASE = "/templates-meme";

// Every format mapping is keyed by id. The order here is also the
// display order in the picker.
export const memeFormats = [
  {
    id: "distracted-boyfriend",
    name: "Distracted Boyfriend",
    file: `${FILE_BASE}/distracted-boyfriend.jpg`,
    width: 1200,
    height: 800,
    description:
      "Three labels: a guy ignoring his girlfriend to gawk at someone new. Use it for 'I should be doing X but I'm doing Y' moments.",
    jokeStructure:
      "GIRLFRIEND = the responsible thing the teacher should be focused on (lesson plan, grading). BOYFRIEND = 'Me' or a 1-3 word self-tag. NEWGIRL = the irresistible distraction pulling the teacher's attention. Same teacher, same moment of weakness. E.g. GIRLFRIEND='Lesson plan' / BOYFRIEND='Me' / NEWGIRL='One student asking a completely unrelated question'.",
    zones: [
      {
        key: "newGirl",
        label: "Other woman (the distraction)",
        x: 0.02, y: 0.28, w: 0.34, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 44,
      },
      {
        key: "boyfriend",
        label: "Boyfriend (\"me\")",
        x: 0.36, y: 0.50, w: 0.22, h: 0.14,
        align: "center", style: "caption", maxLines: 2, minFontSize: 36,
      },
      {
        key: "girlfriend",
        label: "Girlfriend (what I should be focused on)",
        x: 0.62, y: 0.38, w: 0.36, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 44,
      },
    ],
    exampleCaptions: [
      { newGirl: "One student asking a completely unrelated question", boyfriend: "Me", girlfriend: "Lesson plan" },
      { newGirl: "Anchor charts on Pinterest", boyfriend: "Me on Sunday night", girlfriend: "Actual lesson planning" },
      { newGirl: "Reorganizing my classroom library", boyfriend: "Me", girlfriend: "Grading the test from October" },
      { newGirl: "A 'free pizza in the lounge' email", boyfriend: "Me", girlfriend: "Hall duty" },
      { newGirl: "Group chat drama with the team next door", boyfriend: "Me", girlfriend: "My plan period" },
      { newGirl: "TikTok at 11pm", boyfriend: "Me", girlfriend: "Going to bed before midnight" },
    ],
  },

  {
    id: "drake",
    name: "Drake Yes / No",
    file: `${FILE_BASE}/drake.jpg`,
    width: 1200,
    height: 1200,
    description:
      "Drake rejects the obvious good thing on top, points approvingly at the chaos on bottom. Perfect for 'students will do this but not that.'",
    jokeStructure:
      "Both panels MUST describe the same situation / same subject. NO panel = the obvious good / sensible / expected behavior (what you wish would happen). YES panel = the absurd / chaotic / actual reality. Same subject, sharp opposition. E.g. NO='Students reading directions' / YES='Students asking what are we doing'.",
    zones: [
      {
        key: "no",
        label: "Top panel: what Drake REJECTS",
        x: 0.50, y: 0.04, w: 0.46, h: 0.42,
        align: "center", style: "dark-on-light", maxLines: 4,
      },
      {
        key: "yes",
        label: "Bottom panel: what Drake APPROVES",
        x: 0.50, y: 0.54, w: 0.46, h: 0.42,
        align: "center", style: "dark-on-light", maxLines: 4,
      },
    ],
    exampleCaptions: [
      { no: "Students reading directions", yes: "Students asking 'what are we doing?'" },
      { no: "Reading the rubric I handed out", yes: "Asking how to get an A" },
      { no: "Using the 5 minutes I gave for questions", yes: "Asking the second I say 'pencils down'" },
      { no: "Studying the 3-page review", yes: "Telling me 'the test was unfair'" },
      { no: "Going to the bathroom at lunch", yes: "Going to the bathroom 4 minutes into the lesson" },
      { no: "Writing their name on the paper", yes: "Writing their name in 3D bubble letters worth zero points" },
    ],
  },

  {
    id: "one-does-not-simply",
    name: "One Does Not Simply",
    file: `${FILE_BASE}/one-does-not-simply.jpg`,
    width: 617,
    height: 617,
    description:
      "Boromir making his iconic point. For the impossible asks of teaching life: 'one does not simply...'",
    jokeStructure:
      "TOP = the start of the line, almost always 'One does not simply'. BOTTOM = the impossible or absurd teaching task that one cannot, in fact, simply do. Keep each line punchy. E.g. TOP='One does not simply' / BOTTOM='Make it to Friday without a fire drill'.",
    zones: [
      {
        key: "top",
        label: "Top: usually \"One does not simply\"",
        x: 0.03, y: 0.22, w: 0.94, h: 0.12,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.42,
      },
      {
        key: "bottom",
        label: "Bottom: the impossible teaching task",
        x: 0.03, y: 0.66, w: 0.94, h: 0.18,
        align: "center", style: "caption", maxLines: 3, strokeRatio: 0.42,
      },
    ],
    galleryTemplate: `${FILE_BASE}/one-does-not-simply-gallery.png`,
    galleryZones: [
      {
        key: "top",
        label: "Top: usually \"One does not simply\"",
        x: 0.03, y: 0.26, w: 0.94, h: 0.085,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.42,
      },
      {
        key: "bottom",
        label: "Bottom: the impossible teaching task",
        x: 0.03, y: 0.68, w: 0.94, h: 0.13,
        align: "center", style: "caption", maxLines: 3, strokeRatio: 0.42,
      },
    ],
    exampleCaptions: [
      { top: "One does not simply", bottom: "Teach all day without a little fun and a lot of backup" },
      { top: "One does not simply", bottom: "Make it to Friday without a fire drill" },
      { top: "One does not simply", bottom: "Check email without finding three new meetings" },
      { top: "One does not simply", bottom: "Finish the lesson before the bell rings" },
      { top: "One does not simply", bottom: "Get through a sub day without a note home" },
    ],
  },

  {
    id: "success-kid",
    name: "Success Kid",
    file: `${FILE_BASE}/success-kid.jpg`,
    width: 500,
    height: 500,
    description:
      "Tiny child pumping his fist on the beach. Use it to celebrate small, specific teacher victories.",
    jokeStructure:
      "TOP = the setup of an absurdly low-bar achievement. BOTTOM = the small win itself, said with quiet triumph. The joke is that the win is both pathetic AND genuinely satisfying. E.g. TOP='Planned a 45-minute lesson' / BOTTOM='It actually lasted 45 minutes'.",
    zones: [
      {
        key: "top",
        label: "Top: the setup",
        x: 0.03, y: 0.02, w: 0.94, h: 0.20,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.42,
      },
      {
        key: "bottom",
        label: "Bottom: the win",
        x: 0.03, y: 0.78, w: 0.94, h: 0.20,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.42,
      },
    ],
    exampleCaptions: [
      { top: "Planned a 45-minute lesson", bottom: "It actually lasted 45 minutes" },
      { top: "Made it to Friday", bottom: "Without crying in the supply closet" },
      { top: "Asked who has questions", bottom: "Got real questions, not 'can I go to the bathroom'" },
      { top: "Copier worked on the first try", bottom: "On a Monday morning" },
      { top: "Said 'one more thing'", bottom: "It actually was one more thing" },
      { top: "Found a working dry-erase marker", bottom: "In the first drawer I checked" },
    ],
  },

  {
    id: "grumpy-cat",
    name: "Grumpy Cat",
    file: `${FILE_BASE}/grumpy-cat.jpg`,
    width: 500,
    height: 616,
    description:
      "The original 'no' face. Pure deadpan refusal. Pair a well-intentioned plan with reality.",
    jokeStructure:
      "TOP = the hopeful intent or plan. BOTTOM = reality crushing it. Same subject, two halves of one moment. The bottom is delivered like a flat, deadpan correction. E.g. TOP='I had a plan' / BOTTOM='They had other plans'.",
    zones: [
      {
        key: "top",
        label: "Top",
        x: 0.03, y: 0.03, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "Bottom",
        x: 0.03, y: 0.75, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "I had a plan", bottom: "They had other plans" },
      { top: "I made it engaging", bottom: "They made it 11 minutes long" },
      { top: "Three days off in a row", bottom: "Two of them are 'planning days'" },
      { top: "Sub plans took 2 hours", bottom: "Sub left at lunch" },
      { top: "I said 'last question'", bottom: "It was not the last question" },
      { top: "Spring break starts Friday", bottom: "Field trip starts Thursday" },
    ],
  },

  {
    id: "disaster-girl",
    name: "Disaster Girl",
    file: `${FILE_BASE}/disaster-girl.jpg`,
    width: 500,
    height: 375,
    description:
      "Little girl smirking while a house burns behind her. For when chaos is not your fault but you're vibing with it.",
    jokeStructure:
      "TOP = a setup describing a moment where chaos is unfolding. BOTTOM = the chaos itself, delivered with smug acceptance. The teacher isn't causing the chaos — they're watching it happen and quietly enjoying it. E.g. TOP='When admin walks in' / BOTTOM='Right as the class goes feral'.",
    zones: [
      {
        key: "top",
        label: "Top: what's happening",
        x: 0.03, y: 0.03, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.38,
      },
      {
        key: "bottom",
        label: "Bottom: the chaos",
        x: 0.03, y: 0.75, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2, strokeRatio: 0.38,
      },
    ],
    exampleCaptions: [
      { top: "When admin walks in", bottom: "Right as the class goes feral" },
      { top: "When I left my own classroom for 30 seconds", bottom: "And came back to a small society" },
      { top: "When the sub said 'they were great'", bottom: "And I see the room" },
      { top: "Indoor recess + Friday afternoon", bottom: "You can't stop me, you can only watch" },
      { top: "Me handing out scissors and glue", bottom: "Knowing exactly how this ends" },
      { top: "When two kids fight over a glue stick", bottom: "I'm not stopping them, I'm taking notes" },
    ],
  },

  {
    id: "woman-yelling-at-cat",
    name: "Woman Yelling at Cat",
    file: `${FILE_BASE}/woman-yelling-at-cat.jpg`,
    width: 680,
    height: 438,
    description:
      "Hysterical accuser on the left, smug confused cat on the right. Two takes on the same situation that don't agree.",
    jokeStructure:
      "WOMAN = an exasperated teacher accusation, usually a question or pointed statement. CAT = the student's smug, confidently-wrong defense. Same incident, two POVs that don't line up. E.g. WOMAN='Why didn't you turn it in?' / CAT='I was absent... for 5 minutes'.",
    zones: [
      {
        key: "woman",
        label: "Yelling woman (left): the accusation",
        x: 0.02, y: 0.68, w: 0.46, h: 0.28,
        align: "center", style: "caption", maxLines: 2, maxFontSize: 88,
        minFontSize: 44,
      },
      {
        key: "cat",
        label: "Confused cat (right): the defense",
        x: 0.52, y: 0.68, w: 0.46, h: 0.28,
        align: "center", style: "caption", maxLines: 2, maxFontSize: 88,
        minFontSize: 44,
      },
    ],
    exampleCaptions: [
      { woman: "Why didn't you turn it in?", cat: "I was absent... for 5 minutes" },
      { woman: "Where is the syllabus you've had since August?", cat: "I've literally never seen this document" },
      { woman: "Read the directions before asking", cat: "What are we doing again?" },
      { woman: "You missed 14 days this quarter", cat: "Why is my grade like this" },
      { woman: "We took notes on this Tuesday", cat: "First time I'm hearing about this" },
      { woman: "Show your work", cat: "I did it in my head and got the wrong answer" },
    ],
  },

  {
    id: "this-is-fine",
    name: "This Is Fine",
    file: `${FILE_BASE}/this-is-fine.jpg`,
    width: 580,
    height: 282,
    description:
      "Cartoon dog in a burning room calmly drinking coffee. Use it for low-key catastrophic teacher moments.",
    jokeStructure:
      "TOP = a specific catastrophic teacher problem, stated as a flat fact. BOTTOM = literally just 'This is fine.' (keep this exact phrase — it IS the joke). E.g. TOP='Stack of ungraded papers' / BOTTOM='This is fine.'",
    zones: [
      {
        key: "top",
        label: "Top: the catastrophe",
        x: 0.03, y: 0.04, w: 0.94, h: 0.30,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48, strokeRatio: 0.42,
      },
      {
        key: "bottom",
        label: "Bottom: usually \"This is fine.\"",
        x: 0.03, y: 0.70, w: 0.94, h: 0.26,
        align: "center", style: "caption", maxLines: 2, minFontSize: 52, strokeRatio: 0.42,
      },
    ],
    exampleCaptions: [
      { top: "Stack of ungraded papers", bottom: "This is fine." },
      { top: "Lesson plans due tomorrow, I have not started", bottom: "This is fine." },
      { top: "Fire drill in 4 minutes, I have a sub tomorrow", bottom: "This is fine." },
      { top: "Three IEP meetings before lunch", bottom: "This is fine." },
      { top: "I have not eaten since 6:45am", bottom: "This is fine." },
      { top: "47 emails, 12 are urgent, none are from admin", bottom: "This is fine." },
    ],
  },

  {
    id: "surprised-pikachu",
    name: "Surprised Pikachu",
    file: `${FILE_BASE}/surprised-pikachu.jpg`,
    width: 1893,
    height: 1892,
    description:
      "Pikachu's open-mouthed shock at a totally predictable outcome. The setup is the joke.",
    jokeStructure:
      "TOP = a perfectly predictable cause (something a teacher said or did). BOTTOM = the obvious consequence delivered with mock-shock. The humor is that everyone saw this coming except the person reacting. E.g. TOP='Doesn't write anything down all unit' / BOTTOM='Bombs the open-note test'.",
    zones: [
      {
        key: "top",
        label: "Top: the predictable cause",
        x: 0.04, y: 0.02, w: 0.92, h: 0.28,
        align: "center", style: "caption-inverted", maxLines: 2, minFontSize: 52,
      },
      {
        key: "bottom",
        label: "Bottom: the \"shocking\" effect",
        x: 0.04, y: 0.72, w: 0.92, h: 0.26,
        align: "center", style: "caption", maxLines: 2, minFontSize: 52,
      },
    ],
    exampleCaptions: [
      { top: "Teacher: 'The test is tomorrow'", bottom: "Students: don't study\nAlso students:" },
      { top: "Doesn't write anything down all unit", bottom: "Bombs the open-note test" },
      { top: "Talks the whole class period", bottom: "Has no idea what the homework is" },
      { top: "Skipped every review day", bottom: "Now needs extra credit by Friday" },
      { top: "Asks 'is this graded' before doing anything", bottom: "Mad it's graded" },
      { top: "Doesn't read the rubric", bottom: "Doesn't get the grade on the rubric" },
    ],
  },

  {
    id: "mocking-spongebob",
    name: "Mocking SpongeBob",
    file: `${FILE_BASE}/mocking-spongebob.jpg`,
    width: 502,
    height: 353,
    description:
      "Top: a normal sentence. Bottom: the same sentence in mocking sPoNgEbOb cAsE. Iconic for repeating what students just said.",
    jokeStructure:
      "TOP = a label naming the speaker (e.g. 'Students:', 'Admin:', 'Me on Sunday:'). BOTTOM = the actual eye-roll-inducing phrase that speaker said. The renderer will auto-apply mIxEd cAsE to the bottom. Write the bottom in normal case — DON'T pre-mix. E.g. TOP='Students:' / BOTTOM='When are we ever gonna use this in real life'.",
    zones: [
      {
        key: "top",
        label: "Top: what they said (normal text)",
        x: 0.03, y: 0.03, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 3,
      },
      {
        key: "bottom",
        label: "Bottom: same thing in mOcKiNg cAsE (auto-applied)",
        x: 0.03, y: 0.68, w: 0.94, h: 0.26,
        align: "center", style: "mocking", maxLines: 2, minFontSize: 44,
      },
    ],
    exampleCaptions: [
      { top: "StUdEnTs:", bottom: "When are we ever gonna use this in real life" },
      { top: "Students:", bottom: "When are we ever gonna use this in real life" },
      { top: "Me on Sunday:", bottom: "I'm gonna get ahead on grading this weekend" },
      { top: "Admin:", bottom: "Just differentiate it" },
      { top: "Me at 5pm Friday:", bottom: "I'll catch up on it Monday morning" },
      { top: "Me in August:", bottom: "This year I'll have a real work-life balance" },
    ],
  },

  {
    id: "hide-the-pain-harold",
    name: "Hide the Pain Harold",
    file: `${FILE_BASE}/hide-the-pain-harold.jpg`,
    width: 480,
    height: 601,
    description:
      "Old man smiling through visible suffering. The teacher meme of all teacher memes.",
    jokeStructure:
      "TOP = a cheerful, fake-positive thing you say OUT LOUD (often in quotes). BOTTOM = the painful inner truth, written in *asterisks* or (parentheses) like a stage direction. The two MUST be about the same moment. E.g. TOP='I love my job' / BOTTOM='*3rd time explaining the same thing*'. The asterisks/parens are part of the joke — keep them.",
    zones: [
      {
        key: "top",
        label: "Top: the cheerful claim",
        x: 0.03, y: 0.02, w: 0.94, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 44,
      },
      {
        key: "bottom",
        label: "Bottom: the painful truth",
        x: 0.03, y: 0.80, w: 0.94, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 40,
      },
    ],
    exampleCaptions: [
      { top: "I love my job", bottom: "*3rd time explaining the same thing*" },
      { top: "Of course, I'd be happy to take on another committee", bottom: "I am five seconds from a breakdown" },
      { top: "No problem, I can cover your class", bottom: "It's my only plan period this week" },
      { top: "Sure, I'll come in early to help with morning duty", bottom: "I've been awake since 4:30" },
      { top: "I'm fine!", bottom: "I have not been fine since October" },
      { top: "Yes, I'd love to chaperone the dance", bottom: "Quietly losing my will to live" },
    ],
  },

  {
    id: "side-eye-chloe",
    name: "Side-Eye Chloe",
    file: `${FILE_BASE}/side-eye-chloe.jpg`,
    width: 620,
    height: 396,
    description:
      "Little girl's iconic suspicious side-eye. For announcements that are obviously a trap.",
    jokeStructure:
      "TOP = a too-good-to-be-true announcement, often quoting admin or a parent or a sub (e.g. 'Admin: It's just a quick meeting'). BOTTOM = optional one-line skeptical reaction. The TOP is doing most of the work — leave BOTTOM blank if the announcement is funny enough on its own.",
    zones: [
      {
        key: "top",
        label: "Top: the suspicious announcement",
        x: 0.03, y: 0.02, w: 0.94, h: 0.20,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
      },
      {
        key: "bottom",
        label: "Bottom: optional reaction",
        x: 0.03, y: 0.78, w: 0.94, h: 0.20,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
      },
    ],
    exampleCaptions: [
      { top: "Admin: 'It's just a quick after-school meeting'", bottom: "" },
      { top: "Sub: 'They were perfect angels'", bottom: "Me looking at my classroom:" },
      { top: "Parent email: 'I just have a quick question'", bottom: "" },
      { top: "Email: 'Don't reply, just FYI'", bottom: "Reply-all chain immediately incoming" },
      { top: "Student: 'I had it, I just don't have it right now'", bottom: "" },
      { top: "Admin: 'This is gonna be a fun PD'", bottom: "" },
    ],
  },

  {
    id: "leo-cheers",
    name: "Leo DiCaprio Cheers",
    file: `${FILE_BASE}/leo-cheers.jpg`,
    width: 600,
    height: 400,
    description:
      "Leo raises his glass to you. For shouting out fellow teachers who get it.",
    jokeStructure:
      "TOP = a single warm toast to a fellow teacher's small victory or to surviving the day. Starts with 'Here's to...' or 'To...'. Heart, not snark. E.g. 'Here's to every teacher running on coffee and spite'.",
    zones: [
      {
        key: "top",
        label: "Single line: who/what we're toasting",
        x: 0.03, y: 0.02, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 3,
      },
    ],
    exampleCaptions: [
      { top: "Here's to every teacher running on coffee and spite" },
      { top: "To the teacher who shared their laminator. We don't deserve you." },
      { top: "Here's to making it to the long weekend" },
      { top: "To the kid who said 'this was actually fun'" },
      { top: "Here's to closing the laptop at a reasonable hour" },
      { top: "To the sub who left actual notes. You are a hero." },
    ],
  },

  {
    id: "two-buttons",
    name: "Two Buttons",
    file: `${FILE_BASE}/two-buttons.jpg`,
    width: 600,
    height: 908,
    description:
      "Sweating man agonizing over two impossible buttons. For the daily teacher dilemma.",
    jokeStructure:
      "BUTTON1 + BUTTON2 = two equally-necessary teacher tasks that are impossible to do BOTH at once. PERSON = a 1-3 word self-tag like 'Me' or 'Me on Sunday'. The two buttons must be in REAL TENSION (you can do one or the other, not both). E.g. BUTTON1='Make lesson engaging' / BUTTON2='Finish curriculum on time' / PERSON='Me'.",
    zones: [
      {
        key: "button1",
        label: "Left red button",
        x: 0.03, y: 0.03, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 40,
      },
      {
        key: "button2",
        label: "Right red button",
        x: 0.51, y: 0.03, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 40,
      },
      {
        key: "person",
        label: "Sweating person (the teacher)",
        x: 0.05, y: 0.90, w: 0.78, h: 0.08,
        align: "center", style: "caption", maxLines: 1, minFontSize: 48,
      },
    ],
    exampleCaptions: [
      { button1: "Make lesson engaging", button2: "Finish curriculum on time", person: "Me" },
      { button1: "Grade the papers tonight", button2: "Sleep more than 5 hours", person: "Me on Sunday" },
      { button1: "Build student relationships", button2: "Cover 50 standards by April", person: "Me, every year" },
      { button1: "Keep the rules", button2: "Pick my battles", person: "Me at 1:55pm" },
      { button1: "Use the curriculum", button2: "Use the lesson that actually works", person: "Me, observed by admin" },
      { button1: "Differentiate for 32 kids", button2: "Have any personality left at 3pm", person: "Me" },
    ],
  },

  {
    id: "expanding-brain",
    name: "Expanding Brain",
    file: `${FILE_BASE}/expanding-brain.jpg`,
    width: 857,
    height: 1202,
    description:
      "Four progressively more enlightened/insane brains. Use it to escalate a teacher take from sensible to unhinged.",
    jokeStructure:
      "All 4 panels MUST be variations on the SAME teacher topic, escalating in absurdity. LEVEL1 = the boring/normal way. LEVEL2 = a slightly less normal twist. LEVEL3 = a galaxy-brain optimization. LEVEL4 = unhinged but somehow makes sense. E.g. on homework: 'Give homework' → 'Don't give homework' → 'Assign it but don't collect it' → 'Make it a choice board so they assign it themselves'.",
    zones: [
      {
        key: "level1",
        label: "Brain 1: the sensible take",
        x: 0.03, y: 0.02, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
        maskFill: "rgba(0,0,0,0.94)",
      },
      {
        key: "level2",
        label: "Brain 2: slightly bigger brain",
        x: 0.03, y: 0.27, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
        maskFill: "rgba(0,0,0,0.94)",
      },
      {
        key: "level3",
        label: "Brain 3: galaxy brain",
        x: 0.03, y: 0.52, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
        maskFill: "rgba(0,0,0,0.94)",
      },
      {
        key: "level4",
        label: "Brain 4: cosmic brain",
        x: 0.03, y: 0.77, w: 0.42, h: 0.22,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
        maskFill: "rgba(0,0,0,0.94)",
      },
    ],
    exampleCaptions: [
      {
        level1: "Give homework",
        level2: "Don't give homework",
        level3: "Assign it but don't collect it",
        level4: "Make it a 'choice board' so they assign it to themselves",
      },
      {
        level1: "Plan a lesson",
        level2: "Reuse last year's lesson",
        level3: "Reuse the lesson and tell them it's brand new",
        level4: "Have them teach the lesson while I 'facilitate'",
      },
      {
        level1: "Grade papers",
        level2: "Grade papers in the parking lot",
        level3: "Grade papers during the staff meeting",
        level4: "Have students peer-grade and call it 'rigor'",
      },
      {
        level1: "Use the projector",
        level2: "Use the projector AND a worksheet",
        level3: "Use the projector, a worksheet, AND a Kahoot",
        level4: "Stand silently and let them figure it out",
      },
      {
        level1: "Differentiate the worksheet",
        level2: "Differentiate the directions",
        level3: "Differentiate the entire lesson",
        level4: "Make 32 IEPs by lunch",
      },
    ],
  },

  {
    id: "change-my-mind",
    name: "Change My Mind",
    file: `${FILE_BASE}/change-my-mind.jpg`,
    width: 482,
    height: 361,
    description:
      "Man at a folding table with a sign reading your provocative teacher take. Change my mind.",
    jokeStructure:
      "SIGN = a single bold, opinionated teacher take that almost every teacher secretly agrees with. Confident, declarative, slightly spicy but never mean. The 'Change my mind.' part is already on the image — don't write it. E.g. SIGN='Group work actually means one kid does everything'.",
    zones: [
      {
        key: "sign",
        label: "What's on the cardboard sign",
        // The sign sits in the bottom-right of the image. We aim for
        // the top half of the cardboard so it lands above the
        // "Change my mind." text already printed there.
        x: 0.52, y: 0.58, w: 0.44, h: 0.28,
        align: "center", style: "sign", maxLines: 2, maxFontSize: 72,
        minFontSize: 40,
      },
    ],
    exampleCaptions: [
      { sign: "Group work actually means one kid does everything" },
      { sign: "Field trip days are a paid 6-hour walk" },
      { sign: "PD before 8am should count as overtime" },
      { sign: "Open house is just standing politely for 90 minutes" },
      { sign: "If I write 'see me' on a paper, I forget within 12 minutes" },
      { sign: "The first week back from break is a complete write-off" },
    ],
  },

  {
    id: "is-this-a-pigeon",
    name: "Is This a Pigeon?",
    file: `${FILE_BASE}/is-this-a-pigeon.jpg`,
    width: 1587,
    height: 1425,
    description:
      "Anime guy gestures at a butterfly and asks if it's a pigeon. For when teachers misidentify the obvious.",
    jokeStructure:
      "BUTTERFLY = a thing that's clearly NOT what someone is calling it. PERSON = the person making the wrong identification. QUESTION = 'Is this a [X]?' where X is the wrong / generous label being applied. E.g. BUTTERFLY='A student doing the bare minimum' / PERSON='Me' / QUESTION='IS THIS A LEARNER?'.",
    zones: [
      {
        key: "butterfly",
        label: "Butterfly label (top right)",
        x: 0.62, y: 0.02, w: 0.36, h: 0.16,
        align: "center", style: "caption", maxLines: 3,
      },
      {
        key: "person",
        label: "Anime guy label",
        x: 0.04, y: 0.62, w: 0.30, h: 0.14,
        align: "center", style: "caption", maxLines: 3,
      },
      {
        key: "question",
        label: "Bottom: \"Is this a pigeon?\" line",
        x: 0.04, y: 0.86, w: 0.92, h: 0.12,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { butterfly: "A student doing the bare minimum", person: "Me", question: "IS THIS A LEARNER?" },
      { butterfly: "An email chain with 14 replies", person: "Admin", question: "IS THIS A MEETING?" },
      { butterfly: "A worksheet I made in 2017", person: "Me Sunday night", question: "IS THIS A NEW LESSON?" },
      { butterfly: "Reading the syllabus to them on day 1", person: "Me", question: "IS THIS A FULL YEAR'S COMMUNICATION PLAN?" },
      { butterfly: "Getting through Tuesday", person: "Me at 7am Wednesday", question: "IS THIS A WEEK?" },
      { butterfly: "30 minutes alone in my classroom", person: "Me", question: "IS THIS A WEEKEND?" },
    ],
  },

  {
    id: "ancient-aliens",
    name: "Ancient Aliens Guy",
    file: `${FILE_BASE}/ancient-aliens.jpg`,
    width: 500,
    height: 436,
    description:
      "Wild-haired History Channel guy who knows the real reason. For zero-evidence teacher conspiracy theories.",
    jokeStructure:
      "TOP = a real classroom mystery posed as a question. BOTTOM = a one-word answer (often 'Aliens.') that explains everything with zero evidence. Confident, deadpan delivery. E.g. TOP='Why did the copier jam on the test?' / BOTTOM='Aliens.'",
    zones: [
      {
        key: "top",
        label: "Top: the question",
        x: 0.03, y: 0.02, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "Bottom: the 'real' answer",
        x: 0.03, y: 0.74, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "Why is it so loud in the hallway?", bottom: "Aliens. (It's 2:47pm)" },
      { top: "Why did every kid forget their pencil today?", bottom: "Aliens." },
      { top: "Why did the copier jam on the test?", bottom: "Aliens." },
      { top: "Why is the WiFi out for the digital quiz?", bottom: "Aliens." },
      { top: "Why is everyone tired at the same time?", bottom: "Daylight saving. I mean, aliens." },
      { top: "Who keeps stealing my favorite pen?", bottom: "Aliens. Definitely the kid in row 3." },
    ],
  },

  {
    id: "pepe",
    name: "Sad Pepe",
    file: `${FILE_BASE}/pepe.jpg`,
    width: 512,
    height: 512,
    description:
      "A quiet, frowning frog. For 'feels [adjective] man' teacher moods.",
    jokeStructure:
      "TOP = the situation, stated flatly. BOTTOM = literally 'feels [adjective] man' in lowercase, where [adjective] is a feeling. The 'feels X man' template is mandatory — that IS the meme. E.g. TOP='Finishes grading at midnight' / BOTTOM='feels tired man'.",
    zones: [
      {
        key: "top",
        label: "Top: the situation",
        x: 0.03, y: 0.02, w: 0.94, h: 0.24,
        align: "center", style: "caption", maxLines: 1, maxFontSize: 88,
        minFontSize: 52,
      },
      {
        key: "bottom",
        label: "Bottom: usually \"feels [X] man\"",
        x: 0.03, y: 0.76, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2, maxFontSize: 80,
        minFontSize: 48,
      },
    ],
    exampleCaptions: [
      { top: "Finishes grading at midnight", bottom: "feels tired man" },
      { top: "Realized I'm \"the strict one\" now", bottom: "feels old man" },
      { top: "First day of summer break", bottom: "feels free man" },
      { top: "Nobody noticed my cute bulletin board", bottom: "feels invisible man" },
      { top: "Forgot it was picture day. Wore my old hoodie.", bottom: "feels iconic man" },
      { top: "Snow day cancelled at 5:01am", bottom: "feels betrayed man" },
    ],
  },

  {
    id: "rickroll",
    name: "Never Gonna Give You Up",
    file: `${FILE_BASE}/rickroll.jpg`,
    width: 620,
    height: 422,
    description:
      "Rick Astley in his iconic trench coat. For when you're committing 100% to teacher chaos.",
    jokeStructure:
      "TOP = the link / button / promise the teacher offered (sounds legit). BOTTOM = an exact lyric from 'Never Gonna Give You Up' (Never gonna give you up / let you down / run around and desert you / make you cry / say goodbye / tell a lie and hurt you). The joke is the rickroll. E.g. TOP=\"Today's lesson link:\" / BOTTOM='Never gonna give you up'.",
    zones: [
      {
        key: "top",
        label: "Top: the link / setup",
        x: 0.03, y: 0.02, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "Bottom: the reveal",
        x: 0.03, y: 0.74, w: 0.94, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "Today's lesson link:", bottom: "Never gonna give you up" },
      { top: "Click for the answer key", bottom: "Never gonna let you down" },
      { top: "Click here for the makeup work", bottom: "Never gonna run around and desert you" },
      { top: "Open the Google doc 'Final Review'", bottom: "Never gonna give, never gonna give" },
      { top: "QR code for today's exit ticket", bottom: "Never gonna tell a lie and hurt you" },
      { top: "When students ask for the 'real' study guide", bottom: "Never gonna make you cry" },
    ],
  },

  {
    id: "doge",
    name: "Doge",
    file: `${FILE_BASE}/doge.jpg`,
    width: 620,
    height: 620,
    description:
      "Shiba Inu floating in vibrant Comic Sans. wow. very meme. Teacher edition.",
    jokeStructure:
      "All 4 thoughts MUST be in lowercase Doge speak: 'such [noun]', 'very [adj]', 'much [noun]', and ALWAYS end with 'wow' on the last one. 2-3 words each. Topic-consistent across all four. E.g. 'such grading' / 'very tired' / 'much coffee' / 'wow'.",
    zones: [
      {
        key: "doge1",
        label: "Top-left thought",
        x: 0.04, y: 0.06, w: 0.42, h: 0.14,
        align: "left", style: "doge", maxLines: 2, maxFontSize: 72,
        minFontSize: 44,
        color: "#ff3b3b",
      },
      {
        key: "doge2",
        label: "Top-right thought",
        x: 0.52, y: 0.14, w: 0.42, h: 0.14,
        align: "left", style: "doge", maxLines: 2, maxFontSize: 72,
        minFontSize: 44,
        color: "#34c759",
      },
      {
        key: "doge3",
        label: "Mid thought",
        x: 0.04, y: 0.48, w: 0.42, h: 0.14,
        align: "left", style: "doge", maxLines: 2, maxFontSize: 72,
        minFontSize: 44,
        color: "#3aa0ff",
      },
      {
        key: "doge4",
        label: "Bottom-right thought",
        x: 0.52, y: 0.76, w: 0.42, h: 0.14,
        align: "left", style: "doge", maxLines: 2, maxFontSize: 72,
        minFontSize: 44,
        color: "#ffd60a",
      },
    ],
    exampleCaptions: [
      { doge1: "such grading", doge2: "very tired", doge3: "much coffee", doge4: "wow" },
      { doge1: "such monday", doge2: "very iep", doge3: "much paperwork", doge4: "wow" },
      { doge1: "such quiz", doge2: "very curve", doge3: "much extra credit", doge4: "wow" },
      { doge1: "such field trip", doge2: "very chaperone", doge3: "much headcount", doge4: "wow" },
      { doge1: "such lesson plan", doge2: "very pivot", doge3: "much winging it", doge4: "wow" },
      { doge1: "such friday", doge2: "very weekend", doge3: "much grading", doge4: "wow" },
    ],
  },

  // ── 21. Crying Cat ────────────────────────────────────────────────
  // The white cat with tears streaming, used for "I'm fine 👍 (I am
  // not fine)" energy. Single top caption sits over the cat's
  // forehead, white-with-stroke so it survives the laptop background.
  {
    id: "crying-cat",
    name: "Crying Cat",
    file: "/gallery/crying-cat-papers.png",
    renderFile: "/templates-meme/crying-cat-gallery-papers.png",
    width: 1536,
    height: 1536,
    skipWatermark: true,
    description:
      "Cat with tears in its eyes giving the camera the saddest brave face on the internet. Use it for 'I'm holding it together (I am not holding it together)' moments.",
    jokeStructure:
      "TOP = something a teacher says with fake enthusiasm while internally falling apart. Often starts with 'Yes', 'I'm fine', 'Of course', 'I love'. The crying cat IS the contradiction. E.g. 'I'm fine, the copier always eats my originals'.",
    zones: [
      {
        key: "top",
        label: "What you say while crying inside",
        x: 0.02, y: 0.02, w: 0.96, h: 0.20,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "Yes I love teaching math six periods in a row" },
      { top: "I'm fine, the copier always eats my originals" },
      { top: "It's a great day for a fire drill at 2:47" },
      { top: "I love covering another teacher's class on my plan" },
      { top: "Of course I can plan, teach, and run carpool duty" },
      { top: "Yeah I'll just take it home and grade it tonight" },
    ],
  },

  // ── 22. Math Lady / Confused Lady ──────────────────────────────────
  // 4-panel collage of the "calculating" lady. Single caption banner
  // at the top of the canvas describes the trigger; the panels below
  // are visual punchline. Top zone uses heavy stroke so it stays
  // legible over her face.
  {
    id: "math-lady",
    name: "Math Lady",
    file: `${FILE_BASE}/math-lady.jpg`,
    width: 681,
    height: 445,
    description:
      "Brazilian actress doing increasingly intense mental math with equations floating around her face. Perfect for 'trying to figure out X' moments — math, schedules, who took whose pencil.",
    jokeStructure:
      "TOP = a single line describing a teacher trying to do impossible mental math / logistics. Often starts with 'Me figuring out…', 'Calculating…', 'Counting…'. The thing being calculated is small but absurdly hard. E.g. 'Me figuring out how 3 kids share 2 chromebooks'.",
    zones: [
      {
        key: "top",
        label: "The thing you're trying to calculate",
        x: 0.02, y: 0.01, w: 0.96, h: 0.22,
        align: "center", style: "caption", maxLines: 2, maxFontSize: 72,
        minFontSize: 36,
      },
    ],
    exampleCaptions: [
      { top: "Me figuring out how 3 kids share 2 chromebooks" },
      { top: "Counting kids back from the bathroom" },
      { top: "Calculating how many minutes are 'a few minutes'" },
      { top: "Converting 4 graders' rubrics to a single grade" },
      { top: "Doing the seating chart so the chaos triangle breaks" },
      { top: "Figuring out which kid actually wrote this paper" },
    ],
  },

  // ── 23. Spider-Man Pointing ────────────────────────────────────────
  // Three Spider-Mans pointing at each other. Two captions — one
  // under the left character, one under the right — let two
  // identical-looking situations call each other out.
  {
    id: "spider-pointing",
    name: "Spider-Man Pointing",
    file: `${FILE_BASE}/spider-pointing.jpg`,
    width: 600,
    height: 551,
    description:
      "Three Spider-Mans accusing each other of being the impostor. Use it whenever two (or three) classroom roles are suspiciously identical.",
    jokeStructure:
      "LEFT and RIGHT = two short labels (1-5 words) for two things that should be different but are actually identical. The Spider-Mans pointing IS the joke — the labels just need to name the doppelgangers. E.g. LEFT='Me on Sunday night' / RIGHT='Me Monday at 7am'.",
    zones: [
      {
        key: "left",
        label: "Left Spider-Man label",
        x: 0.02, y: 0.80, w: 0.34, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
      },
      {
        key: "right",
        label: "Right Spider-Man label",
        x: 0.62, y: 0.80, w: 0.36, h: 0.18,
        align: "center", style: "caption", maxLines: 2, minFontSize: 48,
      },
    ],
    exampleCaptions: [
      { left: "Me on Sunday night", right: "Me Monday at 7am" },
      { left: "The sub plans", right: "What actually happened" },
      { left: "Last year's curriculum", right: "This year's curriculum" },
      { left: "Math teacher", right: "Science teacher (also doing math)" },
      { left: "First period chaos", right: "Last period chaos" },
      { left: "The kid who lost the paper", right: "The kid who 'never got it'" },
    ],
  },

  // ── 24. Sad Pablo Escobar ──────────────────────────────────────────
  // The 4-panel "Pablo waiting" template. One caption at top names
  // what's being waited on; the visual repetition is the joke.
  {
    id: "sad-pablo",
    name: "Sad Pablo Waiting",
    file: `${FILE_BASE}/sad-pablo.jpg`,
    width: 720,
    height: 709,
    description:
      "Pablo Escobar staring blankly into the distance, waiting forever. Use it for any teacher waiting situation: parent emails, IT tickets, the bell, snow days.",
    jokeStructure:
      "TOP = a single line starting with 'Waiting for…' that names a teacher thing that takes FOREVER. The image's repeated panels of Pablo waiting do all the comedic work — keep the line short and dry. E.g. 'Waiting for IT to respond to my ticket'.",
    zones: [
      {
        key: "top",
        label: "What you're waiting on (forever)",
        x: 0.04, y: 0.01, w: 0.92, h: 0.20,
        align: "center", style: "caption", maxLines: 2, minFontSize: 52,
      },
    ],
    exampleCaptions: [
      { top: "Waiting for IT to respond to my ticket" },
      { top: "Waiting for that one kid to turn in any work" },
      { top: "Waiting for parents to reply to a single email" },
      { top: "Waiting for the laminator to warm up" },
      { top: "Waiting for admin to restock the staff room coffee" },
      { top: "Waiting for the copier to come back from the dead" },
    ],
  },

  // ── 25. They're the Same Picture (Pam) ─────────────────────────────
  // Gallery AI art is the render source (single Pam frame + papers +
  // bottom punchline). Customize masks baked text and re-renders all
  // three zones in classic Impact caption style — NOT the two-panel TV
  // meme template with yellow subtitles.
  {
    id: "same-picture",
    name: "They're the Same Picture",
    file: "/gallery/same-picture-group-work.png",
    renderFile: "/templates-meme/pam-same-picture-gallery.png",
    width: 1536,
    height: 1536,
    skipWatermark: true,
    description:
      "Pam from The Office holding up two pieces of paper that are 'definitely different' but obviously identical. Use it for two classroom things that pretend to be different but absolutely are not.",
    jokeStructure:
      "LEFT = thing A. RIGHT = thing B that's officially different but is functionally identical. BOTTOM = the punchline ('They're the same picture'). Each paper line 1-5 words.",
    zones: [
      {
        key: "left",
        label: "Left paper (thing A)",
        x: 0.15, y: 0.18, w: 0.30, h: 0.28,
        align: "center", style: "caption", maxLines: 3,
        syncSizeGroup: "papers",
      },
      {
        key: "right",
        label: "Right paper (thing B that's somehow the same)",
        x: 0.56, y: 0.18, w: 0.30, h: 0.32,
        align: "center", style: "caption", maxLines: 3,
        syncSizeGroup: "papers",
      },
      {
        key: "bottom",
        label: "Bottom line (the punchline)",
        x: 0, y: 0.78, w: 1, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      {
        left: "Group work",
        right: "One kid doing all the work",
        bottom: "They're the same picture",
      },
      {
        left: "Lesson plan",
        right: "Whatever happens after the bell rings",
        bottom: "They're the same picture",
      },
      {
        left: "Fire drill",
        right: "Indoor recess",
        bottom: "They're the same picture",
      },
      {
        left: "Differentiation",
        right: "Twelve different lesson plans",
        bottom: "They're the same picture",
      },
      {
        left: "Hall pass",
        right: "Field trip",
        bottom: "They're the same picture",
      },
      {
        left: "Parent-teacher conference",
        right: "Group therapy",
        bottom: "They're the same picture",
      },
    ],
  },

  // ── Gallery-derived customizable formats ────────────────────────────
  // These re-use AI-generated gallery PNGs as their template image so
  // a teacher can click "Customize this template" on ANY gallery card.
  // Gallery thumbnails use the AI PNG in `file` (watermarked by
  // build-gallery.mjs). Customize renders use blank `renderFile`
  // templates when available; otherwise `maskTight` hides baked AI
  // text without full-width black bands. Formats with only an AI
  // source set skipWatermark so we don't stack two logos.
  {
    id: "waiting-skeleton",
    name: "Waiting Skeleton",
    file: "/gallery/waiting-skeleton-it-ticket.png",
    renderFile: "/templates-meme/waiting-skeleton.jpg",
    // Gallery AI art uses full-width top/bottom Impact strips.
    bakedObstacles: [
      { x: 0, y: 0.72, w: 1, h: 0.28 },
      { x: 0, y: 0, w: 1, h: 0.22 },
    ],
    width: 298,
    height: 403,
    description:
      "Skeleton on a park bench, waiting forever. For anything that takes WAY too long — IT tickets, parent replies, the bell.",
    jokeStructure:
      "TOP = the long-suffering 'me waiting for X' setup. BOTTOM = the soul-crushing thing being waited on. Each line 3-7 words.",
    zones: [
      {
        key: "top",
        label: "Top line (me waiting for...)",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "Bottom line (the thing you're waiting on)",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "Me waiting for IT", bottom: "To respond to my ticket" },
      { top: "Me waiting", bottom: "For a quiet planning period" },
      { top: "Me waiting", bottom: "For the copier to stop jamming" },
      { top: "Me waiting for that one email", bottom: "From the parent who hasn't replied" },
      { top: "Me waiting for the bell", bottom: "On a Tuesday" },
    ],
  },

  {
    id: "doomer-wojak",
    name: "Doomer Wojak",
    file: "/gallery/doomer-parent-conferences.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "Hooded sad guy walking away from the building, looking utterly hollow. Use it for any moment that drained your soul a little.",
    jokeStructure:
      "TOP = the moment / activity you just escaped. BOTTOM = the brutal context that made it so heavy. Each line 2-6 words.",
    zones: [
      {
        key: "top",
        label: "Top line (the moment)",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Bottom line (the brutal thing)",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      { top: "Me walking out of", bottom: "Parent-teacher conferences" },
      { top: "Me on Friday afternoon", bottom: "After fifth period" },
      { top: "Me after staff meeting", bottom: "About a new initiative" },
      { top: "Me leaving school", bottom: "On a full-moon Monday" },
    ],
  },

  {
    id: "stonks",
    name: "Stonks",
    file: "/gallery/stonks-laminator.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "The Stonks guy looking up at green arrows. For any small, slightly unhinged teacher win — bonus points if it's an obvious bad idea.",
    jokeStructure:
      "TOP = the dubious teacher decision. BOTTOM = the word STONKS (or a teacher-specific spin on it). 2-8 words top, 1-3 bottom.",
    // NO maskFill on these zones — the AI source image already has
    // classic Impact-style white-on-image captions baked in (no
    // black band). The new caption renders at the same position
    // with the same Impact + outline style, so the gallery default
    // (which uses the original captions) looks identical to the
    // clean AI image. The full-width black bands the user pointed
    // out as "franjas negras" are gone.
    zones: [
      {
        key: "top",
        label: "Top line (the decision)",
        x: 0.02, y: 0.00, w: 0.96, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Bottom line",
        x: 0.02, y: 0.65, w: 0.96, h: 0.34,
        align: "center", style: "caption", maxLines: 1,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      { top: "Bringing the laminator home for inspiration", bottom: "Stonks" },
      { top: "Grading on a curve called 'vibes'", bottom: "Stonks" },
      { top: "Calling indoor recess 'team building'", bottom: "Stonks" },
    ],
  },

  {
    id: "trade-offer",
    name: "Trade Offer",
    file: "/gallery/trade-offer-planning.png",
    renderFile: "/templates-meme/trade-offer.jpg",
    width: 607,
    height: 794,
    // The "STUDENTS, A TRADE OFFER" header band sits across the top
    // of the frame. Force the logo to bottom-right so it doesn't
    // crowd the header or land on the guy's face/hands.
    watermarkCorner: "br",
    description:
      "The 'Trade Offer' guy. Use for any one-sided 'deal' teachers wish admin / parents / students would actually accept.",
    jokeStructure:
      "I_RECEIVE = the tiny modest ask you'd love. YOU_RECEIVE = the comically generous thing you'll give in return. Each line 2-6 words.",
    zones: [
      {
        key: "iReceive",
        label: "I receive: (in the red box)",
        x: 0.02, y: 0.62, w: 0.46, h: 0.36,
        align: "center", style: "sign", maxLines: 3,
        maskFill: "#ffffff",
      },
      {
        key: "youReceive",
        label: "You receive: (in the blue box)",
        x: 0.52, y: 0.62, w: 0.46, h: 0.36,
        align: "center", style: "sign", maxLines: 3,
        maskFill: "#ffffff",
      },
    ],
    exampleCaptions: [
      { iReceive: "One quiet planning period", youReceive: "My entire personality" },
      { iReceive: "A working printer", youReceive: "Literally anything" },
      { iReceive: "Parents reading the email", youReceive: "World peace" },
    ],
  },

  {
    id: "buff-doge-cheems",
    name: "Buff Doge vs Cheems",
    file: "/gallery/buff-doge-cheems-school-year.png",
    renderFile: "/templates-meme/buff-doge-cheems.png",
    width: 937,
    height: 720,
    description:
      "Buff Doge (confident hero) vs Cheems (tired, baby-voiced version). Compare August-energy you to May-energy you, or any optimistic-vs-defeated pairing.",
    jokeStructure:
      "TOP = label for the buff confident version. BOTTOM = label for the wilted Cheems version. Each line 2-6 words.",
    zones: [
      {
        key: "top",
        // No maskFill — render new caption directly over the AI
        // baked text in the same Impact + outline style. The thick
        // outline (strokeRatio 0.28) acts as a built-in shield
        // against partial leaks when customized.
        label: "Top line (the buff one)",
        x: 0, y: 0, w: 1, h: 0.19,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "Bottom line (the cheems one)",
        x: 0, y: 0.81, w: 1, h: 0.19,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "Me in August", bottom: "Me in May" },
      { top: "Me on Monday morning", bottom: "Me by Friday last period" },
      { top: "Year-one teacher me", bottom: "Year-five teacher me" },
    ],
  },

  {
    id: "y-u-no",
    name: "Y U No",
    file: "/gallery/y-u-no-syllabus.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "The classic Y U NO meme guy throwing his hands up in frustration. For any thing students / parents / admin refuse to do.",
    jokeStructure:
      "TOP = who you're addressing. BOTTOM = 'Y U NO + verb-phrase'. Each line 2-7 words.",
    zones: [
      {
        key: "top",
        label: "Top line (who, e.g. STUDENTS:)",
        x: 0.02, y: 0.00, w: 0.96, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Bottom line (Y U NO ...)",
        x: 0.02, y: 0.65, w: 0.96, h: 0.34,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      { top: "Students:", bottom: "Y U NO READ THE SYLLABUS???" },
      { top: "Parents:", bottom: "Y U NO CHECK THE PORTAL" },
      { top: "IT department:", bottom: "Y U NO FIX THE PROJECTOR" },
    ],
  },

  {
    id: "galaxy-brain",
    name: "Galaxy Brain",
    file: "/gallery/galaxy-brain-syllabus.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "The galaxy-brain glowing on a cosmic backdrop. For the absurdly enlightened path a student or admin takes instead of the obvious one.",
    jokeStructure:
      "TOP = the sane / boring option (e.g. 'reading the syllabus'). BOTTOM = the wildly more effortful path they actually took. Each line 3-7 words.",
    zones: [
      {
        key: "top",
        label: "Top line (the simple option)",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Bottom line (the unhinged option)",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      { top: "Reading the syllabus", bottom: "Instead of emailing me" },
      { top: "Following the assignment", bottom: "Inventing a brand-new version" },
    ],
  },

  {
    id: "first-world-problems",
    name: "First World Problems",
    file: "/gallery/first-world-copier.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "The crying woman wiping her eye. For the tiny, oddly specific teacher problems that should be no big deal but somehow are.",
    jokeStructure:
      "TOP = the lucky thing that happened. BOTTOM = the cursed teacher consequence. Each line 3-8 words.",
    zones: [
      {
        key: "top",
        // Full-bleed mask — the original AI caption stroke ran almost
        // edge-to-edge, so a 0.02 inset left visible letter fragments
        // peeking out to the right of the masked band at thumbnail
        // scale (saw "WORK" tails leaking past the band).
        label: "Top line (the lucky thing)",
        x: 0, y: 0, w: 1, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Bottom line (the consequence)",
        x: 0, y: 0.78, w: 1, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      { top: "The copier finally works", bottom: "I'm out of paper" },
      { top: "My prep period is free", bottom: "Three kids show up to talk" },
      { top: "Snow day called", bottom: "Two hours after I drove in" },
    ],
  },

  {
    id: "they-dont-know",
    name: "They Don't Know",
    file: "/gallery/they-dont-know-tired.png",
    renderFile: "/templates-meme/they-dont-know.png",
    width: 671,
    height: 673,
    description:
      "The sad guy at the party with a thought bubble. For the thing you wish the room understood about you.",
    jokeStructure:
      "TOP = 'They don't know...'. BOTTOM = the secret truth about you. Each line 3-9 words.",
    zones: [
      {
        key: "top",
        label: "They don't know...",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "...the actual truth",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      { top: "They don't know", bottom: "I'm just tired, not mad" },
      { top: "They don't know", bottom: "I haven't peed since 7am" },
      { top: "They don't know", bottom: "Their kid is so funny in class" },
    ],
  },

  {
    id: "soyjak-vs-chad",
    name: "Soyjak vs Chad",
    file: "/gallery/wojak-chad-summer.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "Two panels — anxious Wojak on the left, calm confident Chad on the right. For when someone says something exhausting and you respond with one perfect line.",
    jokeStructure:
      "TOP = the chatty Wojak rant being said TO you. BOTTOM = the short Chad reply you actually give. Top 4-12 words, bottom 1-6.",
    zones: [
      {
        key: "top",
        // Full-bleed and tall enough (h: 0.34) to cover BOTH the
        // AI-baked top caption strip AND the speech bubble below
        // it. Customize is disabled for this format because that
        // produces a visually big black band (unavoidable given
        // the AI source).
        label: "The Wojak rant (top)",
        x: 0, y: 0, w: 1, h: 0.34,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "The Chad reply (bottom)",
        x: 0, y: 0.81, w: 1, h: 0.19,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      {
        top: "Omg you must love your summers off!!",
        bottom: "I work 3 jobs",
      },
      {
        top: "So you only work 9-3, must be nice",
        bottom: "I'm grading at 11pm",
      },
    ],
  },

  {
    id: "anakin-padme",
    name: "Anakin & Padmé",
    file: "/gallery/anakin-padme-reinvent.png",
    renderFile: "/templates-meme/anakin-padme.png",
    width: 768,
    height: 768,
    // The auto-corner picker scores by text-zone overlap, but the
    // four-panel layout has zero text in the top-right corner, so
    // the algorithm happily plops the logo on top of Padmé's face.
    // Force bottom-right where the picnic field bg is unimportant.
    watermarkCorner: "br",
    description:
      "Four-panel Anakin and Padmé picnic conversation. The optimistic statement → the silent realization → the reckoning.",
    jokeStructure:
      "PANEL 1 (Anakin, confident): the optimistic plan. PANEL 2 (Padmé, hopeful): the safety check question. PANEL 3 (Anakin, silent): no answer. PANEL 4 (Padmé, panicked): same question, scared. Lines 3-10 words.",
    zones: [
      {
        key: "p1",
        label: "Panel 1: Anakin's optimistic line",
        x: 0.00, y: 0.30, w: 0.50, h: 0.24,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "p2",
        label: "Panel 2: Padmé's hopeful follow-up",
        x: 0.50, y: 0.30, w: 0.50, h: 0.24,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        // Canonical p3 is Anakin staring silently — the AI gallery
        // PNG correctly has NO baked text in this panel, so no mask.
        // Leave the key/zone in place so the schema still lists it
        // (the LLM can choose to leave it blank, or drop a soft echo).
        key: "p3",
        label: "Panel 3: leave blank (or repeat softly)",
        x: 0.02, y: 0.83, w: 0.46, h: 0.16,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "p4",
        label: "Panel 4: Padmé panicked",
        x: 0.50, y: 0.78, w: 0.50, h: 0.22,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      {
        p1: "I'm reinventing my classroom this year",
        p2: "Using the proven stuff, right?",
        p3: "",
        p4: "Using the proven stuff, right?",
      },
    ],
  },

  {
    id: "awkward-monkey",
    name: "Awkward Monkey Puppet",
    file: "/gallery/awkward-monkey-when-will-we-use.png",
    renderFile: "/templates-meme/monkey-puppet.jpg",
    width: 923,
    height: 768,
    description:
      "Puppet monkey side-eyeing in awkward silence. For the moment a student asks a question you do not have an answer to.",
    jokeStructure:
      "TOP = the student's awkward question. BOTTOM = your internal stalling reaction (often *parenthetical*). Lines 3-9 words.",
    zones: [
      {
        key: "top",
        label: "The awkward question",
        x: 0.02, y: 0.00, w: 0.96, h: 0.26,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "Your *looks away* reaction",
        x: 0.02, y: 0.78, w: 0.96, h: 0.20,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      {
        top: "When a kid asks when we'll ever use this",
        bottom: "*looks away nervously*",
      },
    ],
  },

  {
    id: "squidward-window",
    name: "Squidward Window",
    file: "/gallery/squidward-first-year-teachers.png",
    renderFile: "/templates-meme/squidward-window.jpg",
    width: 598,
    height: 420,
    description:
      "Squidward looking out the window at SpongeBob and Patrick having fun. For the moment you watch someone else still have energy you've lost.",
    jokeStructure:
      "TOP = 'Me watching [group]'. BOTTOM = the energy/behavior they still have. Lines 2-8 words.",
    zones: [
      {
        key: "top",
        label: "Me watching ___",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
      },
      {
        key: "bottom",
        label: "...the thing they still have",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      {
        top: "Me watching first-year teachers",
        bottom: "Still having energy in October",
      },
    ],
  },

  {
    id: "conspiracy-board",
    name: "Conspiracy Board",
    file: "/gallery/conspiracy-board-bell-schedule.png",
    renderFile: "/templates-meme/conspiracy-charlie.jpg",
    width: 1024,
    height: 768,
    description:
      "The unhinged red-string conspiracy board. For the moment you are trying to make sense of something genuinely cursed at school.",
    jokeStructure:
      "ONE LINE describing the absurd thing you're piecing together. Usually 'Me trying to figure out [insanely complicated school thing]'. 5-12 words.",
    zones: [
      {
        // The AI gallery PNG bakes the caption in BOTH top and bottom
        // positions (artifact of how it was generated). Canonical
        // imgflip conspiracy-board has only one caption — we keep it
        // at the bottom and hide the baked top text with a decorative
        // mask so it doesn't leak into customized memes.
        key: "topMask",
        x: 0.02, y: 0.00, w: 0.96, h: 0.22,
        decorative: true,
        maskFill: "#0a0a0a",
      },
      {
        key: "bottom",
        label: "What you're trying to solve",
        x: 0.02, y: 0.80, w: 0.96, h: 0.19,
        align: "center", style: "caption", maxLines: 2,
      },
    ],
    exampleCaptions: [
      {
        bottom: "Me trying to figure out the bell schedule for a 2-hour delay",
      },
    ],
  },

  {
    id: "hard-to-swallow-pills",
    name: "Hard to Swallow Pills",
    file: "/gallery/hard-to-swallow-homework.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "Bottle labeled 'Pills that are hard to swallow'. For the uncomfortable teaching truths your colleagues mostly tiptoe around.",
    jokeStructure:
      "TOP = 'Pills that are hard to swallow:'. BOTTOM = the uncomfortable teaching truth. Top 4-7 words, bottom 4-12.",
    zones: [
      {
        key: "top",
        label: "Pills that are hard to swallow:",
        x: 0, y: 0, w: 1, h: 0.20,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        // The AI bake puts 3 lines of caption in the lower third
        // (roughly y:0.66 → y:0.99). We MUST cover all of that or
        // the upper line leaks above our new caption (saw this
        // happen with h:0.24 — "CHANGING MY HOMEWORK" floated free
        // above the band). h:0.36 covers the full baked text region
        // with a small safety margin, while still feeling tighter
        // than the original h:0.41.
        label: "The uncomfortable truth",
        x: 0, y: 0.64, w: 1, h: 0.36,
        align: "center", style: "caption", maxLines: 3,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      {
        top: "Pills that are hard to swallow:",
        bottom: "Changing my homework policy hasn't fixed anything",
      },
    ],
  },

  {
    id: "crying-wojak",
    name: "Crying Wojak",
    file: "/gallery/crying-wojak-differentiate.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "The sobbing Wojak. For the moment you're emotionally drowning in something asked of you that doesn't scale.",
    jokeStructure:
      "TOP = the directive being given to you. BOTTOM = the unspoken reality of what that ACTUALLY means. Each line 3-10 words.",
    zones: [
      {
        key: "top",
        label: "The directive",
        x: 0.02, y: 0.00, w: 0.96, h: 0.32,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "The reality",
        x: 0.02, y: 0.78, w: 0.96, h: 0.21,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      {
        top: "When admin says 'just differentiate it'",
        bottom: "For all 32 of them",
      },
    ],
  },

  {
    id: "sweating-athlete",
    name: "Sweating Athlete",
    file: "/gallery/sweating-athlete-worksheet.png",
    width: 1536,
    height: 1024,
    skipWatermark: true,
    description:
      "Soaked-through guy mid-collapse. For when the energy required to do a 'simple' teacher task is, in fact, infinite.",
    jokeStructure:
      "TOP = 'Me after [Nth time]'. BOTTOM = the exhausting thing you've done that many times. Each line 3-10 words.",
    zones: [
      {
        key: "top",
        label: "Me after...",
        x: 0.02, y: 0.01, w: 0.96, h: 0.18,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
      {
        key: "bottom",
        label: "...what just drained you",
        x: 0.02, y: 0.82, w: 0.96, h: 0.17,
        align: "center", style: "caption", maxLines: 2,
        maskTight: true,
      },
    ],
    exampleCaptions: [
      {
        top: "Me after five periods",
        bottom: "Of explaining the same worksheet",
      },
    ],
  },
];

// ─── Lookups ──────────────────────────────────────────────────────────────

export function getFormatById(id) {
  return memeFormats.find((f) => f.id === id) || null;
}

// Maps a teacher situation to formats that historically work well for it.
// Used by the "surprise me" / Step 1 of the agentic workflow.
export const SITUATION_TO_FORMATS = {
  "monday-chaos": ["this-is-fine", "grumpy-cat", "hide-the-pain-harold", "pepe", "crying-cat", "sad-pablo"],
  "lesson-planning": ["distracted-boyfriend", "two-buttons", "expanding-brain", "drake", "rickroll", "math-lady"],
  "grading-pile": ["this-is-fine", "doge", "pepe", "hide-the-pain-harold", "success-kid", "crying-cat", "sad-pablo"],
  "students-not-reading": ["drake", "woman-yelling-at-cat", "mocking-spongebob", "surprised-pikachu", "ancient-aliens", "spider-pointing"],
  "admin-observation": ["disaster-girl", "hide-the-pain-harold", "side-eye-chloe", "this-is-fine", "two-buttons", "same-picture"],
  "group-work": ["change-my-mind", "is-this-a-pigeon", "drake", "expanding-brain", "two-buttons", "same-picture", "spider-pointing"],
  "testing-day": ["surprised-pikachu", "drake", "this-is-fine", "grumpy-cat", "mocking-spongebob", "math-lady"],
  "differentiation": ["expanding-brain", "two-buttons", "mocking-spongebob", "is-this-a-pigeon", "change-my-mind", "math-lady"],
  "classroom-management": ["disaster-girl", "grumpy-cat", "this-is-fine", "two-buttons", "hide-the-pain-harold", "spider-pointing"],
  "last-period-energy": ["disaster-girl", "this-is-fine", "doge", "pepe", "crying-cat", "sad-pablo"],
};

export function pickFormatForSituation(situationId, excludeIds = []) {
  const candidates = (SITUATION_TO_FORMATS[situationId] || memeFormats.map((f) => f.id))
    .filter((id) => !excludeIds.includes(id))
    .map(getFormatById)
    .filter(Boolean);
  const pool = candidates.length > 0 ? candidates : memeFormats.filter((f) => !excludeIds.includes(f.id));
  return pool[Math.floor(Math.random() * pool.length)] || memeFormats[0];
}

// Returns the JSON shape the LLM must fill for a given format.
//
// Each value is the human-readable zone label PLUS a length hint
// derived from the format's exampleCaptions. The hint matters: some
// zones (e.g. "Boyfriend (me)" on Distracted Boyfriend) are tiny
// labels that should be 1-3 words; others (e.g. the panels of
// Expanding Brain) are full lines. Without an explicit hint, the
// LLM tends to pad every zone with full sentences, which the
// renderer then has to shrink into illegibly small text.
function wordCount(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}
function lengthHintFor(format, zoneKey) {
  const samples = (format.exampleCaptions || [])
    .map((ex) => ex?.[zoneKey])
    .filter((s) => typeof s === "string" && s.trim() !== "");
  if (samples.length === 0) return "4-10 words";
  const counts = samples.map(wordCount).sort((a, b) => a - b);
  const min = counts[0];
  const max = counts[counts.length - 1];
  // Round the band a touch outward so we don't over-constrain.
  const lo = Math.max(1, Math.floor(min));
  const hi = Math.max(lo + 1, Math.ceil(max + 1));
  if (hi <= 4) return `${lo}-${hi} words (short label, e.g. "Me", "Sweating teacher")`;
  if (hi <= 7) return `${lo}-${hi} words`;
  return `${lo}-${hi} words`;
}

// Per-zone character budget. Computed from the zone's pixel
// dimensions at the FINAL render size (templates are upscaled to a
// minimum of OUTPUT_MIN_WIDTH in render.js so every meme has the
// same chunky Impact look as the gallery, regardless of source
// resolution). Keep this constant in sync with render.js.
const CHAR_WIDTH = 0.67;
const SAFETY_FACTOR = 0.92;
const OUTPUT_MIN_WIDTH = 1080;

function renderWidthOf(format) {
  return Math.max(format.width, OUTPUT_MIN_WIDTH);
}

export function maxCharsForZone(format, zone) {
  const renderW = renderWidthOf(format);
  const widthPx = zone.w * renderW;
  const maxLines = zone.maxLines || 2;
  // Min readable font size at render resolution. With renders >=1080
  // wide, even "small" templates have plenty of pixels — we can keep
  // the minimum at 36px which matches the gallery's tight, heavy
  // Impact aesthetic. Anything below ~30px starts looking thin.
  const minFs = 36;
  const charsPerLine = Math.floor(
    (widthPx * SAFETY_FACTOR) / (minFs * CHAR_WIDTH)
  );
  return Math.max(8, charsPerLine * maxLines);
}

export function captionSchemaFor(format) {
  const props = {};
  for (const z of format.zones) {
    if (z.decorative) continue;
    const wordHint = lengthHintFor(format, z.key);
    const charBudget = maxCharsForZone(format, z);
    props[z.key] = `${z.label} — ${wordHint}. HARD LIMIT: ${charBudget} characters max (this zone is physically small).`;
  }
  return props;
}
