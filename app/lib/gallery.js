// ─── Curated meme gallery ───────────────────────────────────────────
//
// 80 hand-curated teacher memes (AI art + template-rendered text variants). Each was image-generated in the
// Disaster-Girl block-letter style, manually brand-safety reviewed
// for K-8 audience (no profanity, no political content, no
// sexual / drug / violence / self-harm content, no identifiable real
// students / teachers, no punching down at kids — sarcasm is always
// directed at the system / inbox / our own coping mechanisms).
//
// `remixFormatId`:
//   - if set, the gallery card shows a "Customize this template"
//     button that deep-links to the live generator with that format
//     pre-selected AND the captions below pre-filled in edit mode
//   - if null, the meme uses a format that doesn't have a live
//     blank-template path yet — gallery-only (still downloadable +
//     shareable, just no customize)
//
// `captions`:
//   structured zone-key → string map matching the format's `zones`
//   array (defined in meme-formats.js). Used to pre-fill the
//   generator's edit form when a teacher clicks "Customize this
//   template". Only present for items with `remixFormatId` set.
//
// Files live in /public/gallery/ — they were originally AI-generated
// in /assets/ and run through scripts/build-gallery.mjs which adds
// the Legends of Learning watermark before they ship.

export const galleryItems = [
  // ── Vadim's picks (featured examples) ────────────────────────────
  {
    id: "v01",
    file: "/gallery/boromir-backup.png",
    formatName: "One Does Not Simply",
    captionPreview:
      "ONE DOES NOT SIMPLY TEACH ALL DAY WITHOUT A LITTLE FUN AND A LOT OF BACKUP",
    remixFormatId: "one-does-not-simply",
    captions: {
      top: "One does not simply",
      bottom: "Teach all day without a little fun and a lot of backup",
    },
    featured: true,
    searchKeywords: ["boromir", "fun", "backup", "support"],
    situations: ["classroom-management", "monday-chaos"],
  },
  {
    id: "v02",
    file: "/gallery/drake-engaging.png",
    formatName: "Drake Yes / No",
    captionPreview:
      "TRYING TO MAKE LEARNING ENGAGING ALL BY YOURSELF / TEACHER MEMES, CURRICULUM GAMES, AND A GROUP CHAT THAT GETS IT",
    remixFormatId: "drake",
    captions: {
      no: "Trying to make learning engaging all by yourself",
      yes: "Teacher memes, curriculum games, and a group chat that gets it",
    },
    featured: true,
    searchKeywords: ["drake", "engaging", "curriculum games", "community"],
    situations: ["lesson-planning", "students-not-reading"],
  },
  // ── Distracted Boyfriend ─────────────────────────────────────────
  {
    id: "g01",
    file: "/gallery/distracted-boyfriend-off-topic.png",
    formatName: "Distracted Boyfriend",
    captionPreview:
      "ONE KID WITH AN OFF-TOPIC QUESTION / ME / LESSON PLAN",
    remixFormatId: "distracted-boyfriend",
    captions: {
      newGirl: "One kid with an off-topic question",
      boyfriend: "Me",
      girlfriend: "Lesson plan",
    },
    situations: ["lesson-planning", "classroom-management"],
  },
  // ── Hide the Pain Harold ─────────────────────────────────────────
  {
    id: "g02",
    file: "/gallery/harold-explaining.png",
    formatName: "Hide the Pain Harold",
    captionPreview:
      "I LOVE MY JOB! / *EXPLAINING THE SAME THING FOR THE 4TH TIME*",
    remixFormatId: "hide-the-pain-harold",
    captions: {
      top: "I love my job!",
      bottom: "*explaining the same thing for the 4th time*",
    },
    situations: ["students-not-reading", "classroom-management"],
  },
  // ── This Is Fine ─────────────────────────────────────────────────
  {
    id: "g03",
    file: "/gallery/this-is-fine-emails.png",
    formatName: "This Is Fine",
    captionPreview: "47 UNREAD PARENT EMAILS / THIS IS FINE.",
    remixFormatId: "this-is-fine",
    captions: {
      top: "47 unread parent emails",
      bottom: "This is fine.",
    },
    situations: ["monday-chaos", "admin-observation"],
  },
  // ── Disaster Girl ────────────────────────────────────────────────
  {
    id: "g04",
    file: "/gallery/disaster-girl-admin.png",
    formatName: "Disaster Girl",
    captionPreview:
      "WHEN ADMIN ASKS / IF EVERYTHING IS ON TRACK",
    remixFormatId: "disaster-girl",
    captions: {
      top: "When admin asks",
      bottom: "If everything is on track",
    },
    situations: ["admin-observation", "classroom-management"],
  },

  // ── Success Kid ──────────────────────────────────────────────────
  {
    id: "g05",
    file: "/gallery/success-kid-grades.png",
    formatName: "Success Kid",
    captionPreview:
      "TURNED IN MY GRADES / FOUR MINUTES BEFORE THE DEADLINE",
    remixFormatId: "success-kid",
    captions: {
      top: "Turned in my grades",
      bottom: "Four minutes before the deadline",
    },
    situations: ["grading-pile"],
  },

  // ── Mocking SpongeBob ────────────────────────────────────────────
  {
    id: "g06",
    file: "/gallery/spongebob-real-life.png",
    formatName: "Mocking SpongeBob",
    captionPreview:
      "STUDENTS: / wHeN aRe We GoNnA uSe ThIs In ReAl LiFe",
    remixFormatId: "mocking-spongebob",
    captions: {
      top: "Students:",
      bottom: "When are we gonna use this in real life",
    },
    situations: ["students-not-reading", "testing-day"],
  },
  // ── Side-Eye Chloe ───────────────────────────────────────────────
  {
    id: "g07",
    file: "/gallery/side-eye-sub.png",
    formatName: "Side-Eye Chloe",
    captionPreview: "WHEN THE SUB SAYS / 'THEY WERE GREAT'",
    remixFormatId: "side-eye-chloe",
    captions: {
      top: "When the sub says",
      bottom: "'They were great'",
    },
    situations: ["classroom-management"],
  },

  // ── Crying Cat ───────────────────────────────────────────────────
  {
    id: "g08",
    file: "/gallery/crying-cat-papers.png",
    formatName: "Crying Cat",
    captionPreview: "I'M FINE I HAVE 87 PAPERS TO GRADE",
    remixFormatId: "crying-cat",
    captions: {
      top: "I'm fine I have 87 papers to grade",
    },
    situations: ["grading-pile"],
  },

  // ── Two Buttons ──────────────────────────────────────────────────
  {
    id: "g09",
    file: "/gallery/two-buttons-sleep.png",
    formatName: "Two Buttons",
    captionPreview:
      "GRADE THE PAPERS / SLEEP MORE THAN 5 HOURS / ME ON SUNDAY",
    remixFormatId: "two-buttons",
    captions: {
      button1: "Grade the papers",
      button2: "Sleep more than 5 hours",
      person: "Me on Sunday",
    },
    situations: ["grading-pile", "lesson-planning"],
  },

  // ── Grumpy Cat ───────────────────────────────────────────────────
  {
    id: "g10",
    file: "/gallery/grumpy-cat-plans.png",
    formatName: "Grumpy Cat",
    captionPreview: "I HAD A PLAN / THEY HAD OTHER PLANS",
    remixFormatId: "grumpy-cat",
    captions: {
      top: "I had a plan",
      bottom: "They had other plans",
    },
    situations: ["lesson-planning", "classroom-management"],
  },

  // ── Doge ─────────────────────────────────────────────────────────
  {
    id: "g11",
    file: "/gallery/doge-grading.png",
    formatName: "Doge",
    captionPreview: "such grading / very tired / much coffee / wow",
    remixFormatId: "doge",
    captions: {
      doge1: "such grading",
      doge2: "very tired",
      doge3: "much coffee",
      doge4: "wow",
    },
    situations: ["grading-pile", "monday-chaos"],
  },

  // ── Expanding Brain ──────────────────────────────────────────────
  {
    id: "g12",
    file: "/gallery/expanding-brain-homework.png",
    formatName: "Expanding Brain",
    captionPreview:
      "GIVE HOMEWORK → DON'T GIVE HOMEWORK → ASSIGN BUT DON'T COLLECT → 'CHOICE BOARD'",
    remixFormatId: "expanding-brain",
    captions: {
      level1: "Give homework",
      level2: "Don't give homework",
      level3: "Assign it but don't collect it",
      level4: "Call it a 'choice board' and let them assign it themselves",
    },
    situations: ["lesson-planning"],
  },

  // ── Distracted Boyfriend (grading) ───────────────────────────────
  {
    id: "g13",
    file: "/gallery/distracted-boyfriend-grading.png",
    formatName: "Distracted Boyfriend",
    captionPreview:
      "LITERALLY ANY OTHER TASK / ME / GRADING THE STACK",
    remixFormatId: "distracted-boyfriend",
    captions: {
      newGirl: "Literally any other task",
      boyfriend: "Me",
      girlfriend: "Grading the stack",
    },
    situations: ["grading-pile", "lesson-planning"],
  },

  // ── Hide the Pain Harold (committee) ─────────────────────────────
  {
    id: "g14",
    file: "/gallery/harold-committee.png",
    formatName: "Hide the Pain Harold",
    captionPreview:
      "ABSOLUTELY, I'D LOVE TO JOIN ANOTHER COMMITTEE / *INTERNAL SCREAMING*",
    remixFormatId: "hide-the-pain-harold",
    captions: {
      top: "Absolutely, I'd love to join another committee",
      bottom: "*internal screaming*",
    },
    situations: ["admin-observation", "monday-chaos"],
  },

  // ── Mocking SpongeBob (work-life) ────────────────────────────────
  {
    id: "g15",
    file: "/gallery/spongebob-work-life.png",
    formatName: "Mocking SpongeBob",
    captionPreview:
      "ME IN AUGUST: / THIS YEAR I WILL HAVE WORK LIFE BALANCE",
    remixFormatId: "mocking-spongebob",
    captions: {
      top: "Me in August:",
      bottom: "This year I will have work life balance",
    },
    situations: ["monday-chaos", "last-period-energy"],
  },

  // ── This Is Fine (urgent emails) ─────────────────────────────────
  {
    id: "g16",
    file: "/gallery/this-is-fine-urgent.png",
    formatName: "This Is Fine",
    captionPreview: "13 EMAILS MARKED 'URGENT' / THIS IS FINE.",
    remixFormatId: "this-is-fine",
    captions: {
      top: "13 emails marked 'urgent'",
      bottom: "This is fine.",
    },
    situations: ["monday-chaos", "admin-observation"],
  },

  // ── Woman Yelling at Cat ─────────────────────────────────────────
  {
    id: "g17",
    file: "/gallery/woman-yelling-cat-turn-in.png",
    formatName: "Woman Yelling at Cat",
    captionPreview:
      "WHY DIDN'T YOU TURN IT IN? / I WAS ABSENT FOR 5 MINUTES",
    remixFormatId: "woman-yelling-at-cat",
    captions: {
      woman: "Why didn't you turn it in?",
      cat: "I was absent for 5 minutes",
    },
    situations: ["students-not-reading", "grading-pile"],
  },

  // ── Change My Mind ───────────────────────────────────────────────
  {
    id: "g18",
    file: "/gallery/change-my-mind-group-work.png",
    formatName: "Change My Mind",
    captionPreview:
      "GROUP WORK ACTUALLY MEANS ONE KID DOES EVERYTHING",
    remixFormatId: "change-my-mind",
    captions: {
      sign: "Group work actually means one kid does everything",
    },
    situations: ["group-work"],
  },

  // ── Is This a Pigeon ─────────────────────────────────────────────
  {
    id: "g19",
    file: "/gallery/pigeon-tuesday.png",
    formatName: "Is This a Pigeon?",
    captionPreview:
      "GETTING THROUGH TUESDAY / ME / IS THIS A WEEK?",
    remixFormatId: "is-this-a-pigeon",
    captions: {
      butterfly: "Getting through Tuesday",
      person: "Me at 7am Wednesday",
      question: "Is this a week?",
    },
    situations: ["monday-chaos", "last-period-energy"],
  },

  // ── Sad Pepe ─────────────────────────────────────────────────────
  {
    id: "g20",
    file: "/gallery/pepe-grading-midnight.png",
    formatName: "Sad Pepe",
    captionPreview: "FINISHED GRADING AT MIDNIGHT / feels tired man",
    remixFormatId: "pepe",
    captions: {
      top: "Finished grading at midnight",
      bottom: "feels tired man",
    },
    situations: ["grading-pile"],
  },

  // ── Doge variants (gallery-only) ─────────────────────────────────
  {
    id: "g21",
    file: "/gallery/buff-doge-cheems-school-year.png",
    formatName: "Buff Doge vs Cheems",
    captionPreview: "ME IN AUGUST / ME IN MAY",
    remixFormatId: "buff-doge-cheems",
    captions: {
      top: "Me in August",
      bottom: "Me in May",
    },
    situations: ["last-period-energy"],
  },

  // ── Y U No ───────────────────────────────────────────────────────
  {
    id: "g22",
    file: "/gallery/y-u-no-syllabus.png",
    formatName: "Y U No",
    captionPreview: "STUDENTS: / Y U NO READ THE SYLLABUS???",
    remixFormatId: "y-u-no",
    captions: {
      top: "Students:",
      bottom: "Y U NO READ THE SYLLABUS???",
    },
    situations: ["students-not-reading"],
  },

  // ── Galaxy Brain ─────────────────────────────────────────────────
  {
    id: "g23",
    file: "/gallery/galaxy-brain-syllabus.png",
    formatName: "Galaxy Brain",
    captionPreview: "READING THE SYLLABUS / INSTEAD OF EMAILING ME",
    remixFormatId: "galaxy-brain",
    captions: {
      top: "Reading the syllabus",
      bottom: "Instead of emailing me",
    },
    situations: ["students-not-reading"],
  },

  // ── They Don't Know ──────────────────────────────────────────────
  {
    id: "g24",
    file: "/gallery/they-dont-know-tired.png",
    formatName: "They Don't Know",
    captionPreview: "THEY DON'T KNOW / I'M JUST TIRED, NOT MAD",
    remixFormatId: "they-dont-know",
    captions: {
      top: "They don't know",
      bottom: "I'm just tired, not mad",
    },
    // AI-baked thought bubble can't be cleanly masked — see soyjak
    // note below for the same trade-off.
    customizable: false,
    situations: ["last-period-energy", "monday-chaos"],
  },

  // ── Stonks ───────────────────────────────────────────────────────
  {
    id: "g25",
    file: "/gallery/stonks-laminator.png",
    formatName: "Stonks",
    captionPreview:
      "BRINGING THE LAMINATOR HOME FOR 'INSPIRATION' / STONKS",
    remixFormatId: "stonks",
    captions: {
      top: "Bringing the laminator home for inspiration",
      bottom: "Stonks",
    },
    situations: ["lesson-planning"],
  },

  // ── First World Problems ─────────────────────────────────────────
  {
    id: "g26",
    file: "/gallery/first-world-copier.png",
    formatName: "First World Problems",
    captionPreview: "THE COPIER FINALLY WORKS / I'M OUT OF PAPER",
    remixFormatId: "first-world-problems",
    captions: {
      top: "The copier finally works",
      bottom: "I'm out of paper",
    },
    situations: ["monday-chaos"],
  },

  // ── Trade Offer ──────────────────────────────────────────────────
  {
    id: "g27",
    file: "/gallery/trade-offer-planning.png",
    formatName: "Trade Offer",
    captionPreview:
      "I RECEIVE: ONE QUIET PLANNING PERIOD / YOU RECEIVE: MY ENTIRE PERSONALITY",
    remixFormatId: "trade-offer",
    captions: {
      iReceive: "One quiet planning period",
      youReceive: "My entire personality",
    },
    situations: ["lesson-planning", "classroom-management"],
  },

  // ── Soyjak vs Chad ───────────────────────────────────────────────
  // No band/mask render style means we can't cleanly hide the AI's
  // baked speech bubble. For default captions the bubble matches
  // the top caption, so gallery looks great. But customizing would
  // leave a stale bubble next to a new caption, so customize is
  // disabled (same trade-off as they-dont-know).
  {
    id: "g28",
    file: "/gallery/wojak-chad-summer.png",
    formatName: "Soyjak vs Chad",
    captionPreview:
      "OMG YOU MUST LOVE YOUR SUMMERS OFF!! / I WORK 3 JOBS",
    remixFormatId: "soyjak-vs-chad",
    captions: {
      top: "Omg you must love your summers off!!",
      bottom: "I work 3 jobs",
    },
    situations: ["last-period-energy"],
  },

  // ── Anakin & Padmé ───────────────────────────────────────────────
  {
    id: "g29",
    file: "/gallery/anakin-padme-reinvent.png",
    formatName: "Anakin & Padmé",
    captionPreview:
      "I'M REINVENTING MY CLASSROOM THIS YEAR / USING THE PROVEN STUFF, RIGHT?",
    remixFormatId: "anakin-padme",
    captions: {
      p1: "I'm reinventing my classroom this year",
      p2: "Using the proven stuff, right?",
      p3: "",
      p4: "Using the proven stuff, right?",
    },
    situations: ["lesson-planning"],
  },

  // ── Awkward Monkey Puppet ────────────────────────────────────────
  {
    id: "g30",
    file: "/gallery/awkward-monkey-when-will-we-use.png",
    formatName: "Awkward Monkey Puppet",
    captionPreview:
      "WHEN A KID ASKS WHEN WE'LL EVER USE THIS / *LOOKS AWAY NERVOUSLY*",
    remixFormatId: "awkward-monkey",
    captions: {
      top: "When a kid asks when we'll ever use this",
      bottom: "*looks away nervously*",
    },
    situations: ["students-not-reading"],
  },

  // ── Squidward Window ─────────────────────────────────────────────
  {
    id: "g31",
    file: "/gallery/squidward-first-year-teachers.png",
    formatName: "Squidward Window",
    captionPreview:
      "ME WATCHING FIRST-YEAR TEACHERS / STILL HAVING ENERGY IN OCTOBER",
    remixFormatId: "squidward-window",
    captions: {
      top: "Me watching first-year teachers",
      bottom: "Still having energy in October",
    },
    situations: ["last-period-energy", "monday-chaos"],
  },

  // ── Conspiracy Board ─────────────────────────────────────────────
  {
    id: "g32",
    file: "/gallery/conspiracy-board-bell-schedule.png",
    formatName: "Conspiracy Board",
    captionPreview:
      "ME TRYING TO FIGURE OUT THE BELL SCHEDULE FOR A 2-HOUR DELAY",
    remixFormatId: "conspiracy-board",
    captions: {
      bottom: "Me trying to figure out the bell schedule for a 2-hour delay",
    },
    situations: ["monday-chaos", "classroom-management"],
  },

  // ── Hard To Swallow Pills ────────────────────────────────────────
  {
    id: "g33",
    file: "/gallery/hard-to-swallow-homework.png",
    formatName: "Hard To Swallow Pills",
    captionPreview:
      "PILLS THAT ARE HARD TO SWALLOW: / CHANGING MY HOMEWORK POLICY HASN'T FIXED ANYTHING",
    remixFormatId: "hard-to-swallow-pills",
    captions: {
      top: "Pills that are hard to swallow:",
      bottom: "Changing my homework policy hasn't fixed anything",
    },
    situations: ["lesson-planning"],
  },

  // ── Crying Wojak ─────────────────────────────────────────────────
  {
    id: "g34",
    file: "/gallery/crying-wojak-differentiate.png",
    formatName: "Crying Wojak",
    captionPreview:
      "WHEN ADMIN SAYS 'JUST DIFFERENTIATE IT' / FOR ALL 32 OF THEM",
    remixFormatId: "crying-wojak",
    captions: {
      top: "When admin says 'just differentiate it'",
      bottom: "For all 32 of them",
    },
    situations: ["differentiation", "admin-observation"],
  },

  // ── Drake-Alt ────────────────────────────────────────────────────
  {
    id: "g35",
    file: "/gallery/drake-alt-winging-it.png",
    formatName: "Drake Yes/No",
    captionPreview:
      "PLANNING IN ADVANCE / WINGING IT 5 MINUTES BEFORE CLASS",
    remixFormatId: "drake",
    captions: {
      no: "Planning in advance",
      yes: "Winging it 5 minutes before class",
    },
    situations: ["lesson-planning", "monday-chaos"],
  },

  // ── Sweating Athlete ─────────────────────────────────────────────
  {
    id: "g36",
    file: "/gallery/sweating-athlete-worksheet.png",
    formatName: "Sweating Athlete",
    captionPreview:
      "ME AFTER FIVE PERIODS / OF EXPLAINING THE SAME WORKSHEET",
    remixFormatId: "sweating-athlete",
    captions: {
      top: "Me after five periods",
      bottom: "Of explaining the same worksheet",
    },
    situations: ["students-not-reading", "last-period-energy"],
  },

  // ── Math Lady ────────────────────────────────────────────────────
  {
    id: "g37",
    file: "/gallery/math-lady-chromebooks.png",
    formatName: "Math Lady",
    captionPreview:
      "ME FIGURING OUT HOW 3 KIDS SHARE 2 CHROMEBOOKS",
    remixFormatId: "math-lady",
    captions: {
      top: "Me figuring out how 3 kids share 2 chromebooks",
    },
    situations: ["differentiation", "classroom-management"],
  },

  // ── Waiting Skeleton ─────────────────────────────────────────────
  {
    id: "g38",
    file: "/gallery/waiting-skeleton-it-ticket.png",
    formatName: "Waiting Skeleton",
    captionPreview: "ME WAITING FOR IT / TO RESPOND TO MY TICKET",
    remixFormatId: "waiting-skeleton",
    captions: {
      top: "Me waiting for IT",
      bottom: "To respond to my ticket",
    },
    situations: ["monday-chaos"],
  },

  // ── Pam Same Picture ─────────────────────────────────────────────
  {
    id: "g39",
    file: "/gallery/same-picture-group-work.png",
    formatName: "They're the Same Picture",
    captionPreview:
      "GROUP WORK / ONE KID DOING EVERYTHING / THEY'RE THE SAME PICTURE",
    remixFormatId: "same-picture",
    captions: {
      left: "Group work",
      right: "One kid doing everything",
      bottom: "They're the same picture",
    },
    situations: ["group-work"],
  },

  // ── Doomer Wojak ─────────────────────────────────────────────────
  {
    id: "g40",
    file: "/gallery/doomer-parent-conferences.png",
    formatName: "Doomer Wojak",
    captionPreview:
      "ME WALKING OUT OF / PARENT-TEACHER CONFERENCES",
    remixFormatId: "doomer-wojak",
    captions: {
      top: "Me walking out of",
      bottom: "Parent-teacher conferences",
    },
    situations: ["admin-observation", "last-period-energy"],
  },

  // ── Surprised Pikachu ────────────────────────────────────────────
  {
    id: "g41",
    file: "/gallery/surprised-pikachu-open-note.png",
    formatName: "Surprised Pikachu",
    captionPreview:
      "DOESN'T WRITE ANYTHING DOWN ALL UNIT / BOMBS THE OPEN-NOTE TEST",
    remixFormatId: "surprised-pikachu",
    captions: {
      top: "Doesn't write anything down all unit",
      bottom: "Bombs the open-note test",
    },
    situations: ["students-not-reading", "grading-pile"],
  },

  // ── Leo DiCaprio Cheers ──────────────────────────────────────────
  {
    id: "g42",
    file: "/gallery/leo-cheers-laminator.png",
    formatName: "Leo DiCaprio Cheers",
    captionPreview:
      "TO THE TEACHER WHO SHARED THEIR LAMINATOR. WE DON'T DESERVE YOU.",
    remixFormatId: "leo-cheers",
    captions: {
      top: "To the teacher who shared their laminator. We don't deserve you.",
    },
    situations: ["monday-chaos", "group-work"],
  },

  // ── Ancient Aliens Guy ───────────────────────────────────────────
  {
    id: "g43",
    file: "/gallery/ancient-aliens-pencils.png",
    formatName: "Ancient Aliens Guy",
    captionPreview:
      "WHY DID EVERY KID FORGET THEIR PENCIL TODAY? / ALIENS.",
    remixFormatId: "ancient-aliens",
    captions: {
      top: "Why did every kid forget their pencil today?",
      bottom: "Aliens.",
    },
    situations: ["classroom-management", "monday-chaos"],
  },

  // ── Sad Pablo Waiting ────────────────────────────────────────────
  {
    id: "g44",
    file: "/gallery/sad-pablo-turn-in-work.png",
    formatName: "Sad Pablo Waiting",
    captionPreview: "WAITING FOR THAT ONE KID TO TURN IN ANY WORK",
    remixFormatId: "sad-pablo",
    captions: { top: "Waiting for that one kid to turn in any work" },
    situations: ["grading-pile", "students-not-reading"],
  },

  // ── Spider-Man Pointing ──────────────────────────────────────────
  {
    id: "g45",
    file: "/gallery/spider-sub-plans.png",
    formatName: "Spider-Man Pointing",
    captionPreview: "THE SUB PLANS / WHAT ACTUALLY HAPPENED",
    remixFormatId: "spider-pointing",
    captions: { left: "The sub plans", right: "What actually happened" },
    situations: ["lesson-planning", "classroom-management"],
  },

  // ── Never Gonna Give You Up ──────────────────────────────────────
  {
    id: "g46",
    file: "/gallery/rickroll-answer-key.png",
    formatName: "Never Gonna Give You Up",
    captionPreview: "CLICK FOR THE ANSWER KEY / NEVER GONNA LET YOU DOWN",
    remixFormatId: "rickroll",
    captions: {
      top: "Click for the answer key",
      bottom: "Never gonna let you down",
    },
    situations: ["students-not-reading", "lesson-planning"],
  },

  // ── Drake Yes / No (rubric) ──────────────────────────────────────
  {
    id: "g47",
    file: "/gallery/drake-rubric.png",
    formatName: "Drake Yes / No",
    captionPreview:
      "READING THE RUBRIC I HANDED OUT / ASKING HOW TO GET AN A",
    remixFormatId: "drake",
    captions: {
      no: "Reading the rubric I handed out",
      yes: "Asking how to get an A",
    },
    situations: ["students-not-reading", "grading-pile"],
  },

  // ── Success Kid (Friday) ─────────────────────────────────────────
  {
    id: "g48",
    file: "/gallery/success-kid-friday.png",
    formatName: "Success Kid",
    captionPreview: "MADE IT TO FRIDAY / WITHOUT CRYING IN THE SUPPLY CLOSET",
    remixFormatId: "success-kid",
    captions: {
      top: "Made it to Friday",
      bottom: "Without crying in the supply closet",
    },
    situations: ["monday-chaos", "last-period-energy"],
  },

  // ── Side-Eye Chloe (sub) ─────────────────────────────────────────
  {
    id: "g49",
    file: "/gallery/side-eye-sub-angels.png",
    formatName: "Side-Eye Chloe",
    captionPreview:
      "SUB: 'THEY WERE PERFECT ANGELS' / ME LOOKING AT MY CLASSROOM:",
    remixFormatId: "side-eye-chloe",
    captions: {
      top: "Sub: 'They were perfect angels'",
      bottom: "Me looking at my classroom:",
    },
    situations: ["classroom-management"],
  },

  // ── Crying Cat (copier) ────────────────────────────────────────────
  {
    id: "g50",
    file: "/gallery/crying-cat-copier.png",
    formatName: "Crying Cat",
    captionPreview: "I'M FINE, THE COPIER ALWAYS EATS MY ORIGINALS",
    remixFormatId: "crying-cat",
    captions: { top: "I'm fine, the copier always eats my originals" },
    situations: ["monday-chaos", "admin-observation"],
  },

  // ── Two Buttons (Sunday) ───────────────────────────────────────────
  {
    id: "g51",
    file: "/gallery/two-buttons-sunday.png",
    formatName: "Two Buttons",
    captionPreview:
      "GRADE THE PAPERS TONIGHT / SLEEP MORE THAN 5 HOURS / ME ON SUNDAY",
    remixFormatId: "two-buttons",
    captions: {
      button1: "Grade the papers tonight",
      button2: "Sleep more than 5 hours",
      person: "Me on Sunday",
    },
    situations: ["grading-pile", "lesson-planning"],
  },

  // ── Grumpy Cat (engaging) ──────────────────────────────────────────
  {
    id: "g52",
    file: "/gallery/grumpy-cat-engaging.png",
    formatName: "Grumpy Cat",
    captionPreview: "I MADE IT ENGAGING / THEY MADE IT 11 MINUTES LONG",
    remixFormatId: "grumpy-cat",
    captions: {
      top: "I made it engaging",
      bottom: "They made it 11 minutes long",
    },
    situations: ["lesson-planning", "classroom-management"],
  },

  // ── Woman Yelling at Cat (syllabus) ────────────────────────────────
  {
    id: "g53",
    file: "/gallery/woman-yelling-syllabus.png",
    formatName: "Woman Yelling at Cat",
    captionPreview: "SYLLABUS FROM AUGUST? / NEVER SAW IT",
    remixFormatId: "woman-yelling-at-cat",
    captions: {
      woman: "Syllabus from August?",
      cat: "Never saw it",
    },
    situations: ["students-not-reading"],
  },

  // ── Change My Mind (field trip) ────────────────────────────────────
  {
    id: "g54",
    file: "/gallery/change-my-mind-field-trip.png",
    formatName: "Change My Mind",
    captionPreview: "FIELD TRIPS = 6-HOUR WALKS",
    remixFormatId: "change-my-mind",
    captions: { sign: "Field trips = 6-hour walks" },
    situations: ["lesson-planning", "last-period-energy"],
  },

  // ── Sad Pepe (strict one) ──────────────────────────────────────────
  {
    id: "g55",
    file: "/gallery/pepe-strict-one.png",
    formatName: "Sad Pepe",
    captionPreview: "THE STRICT ONE / FEELS OLD MAN",
    remixFormatId: "pepe",
    captions: {
      top: "The strict one",
      bottom: "feels old man",
    },
    situations: ["classroom-management"],
  },

  // ── Doge (Monday IEP) ──────────────────────────────────────────────
  {
    id: "g56",
    file: "/gallery/doge-monday-iep.png",
    formatName: "Doge",
    captionPreview: "SUCH MONDAY / VERY IEP / MUCH PAPERWORK / WOW",
    remixFormatId: "doge",
    captions: {
      doge1: "such monday",
      doge2: "very iep",
      doge3: "much paperwork",
      doge4: "wow",
    },
    situations: ["monday-chaos", "admin-observation"],
  },

  // ── Math Lady (bathroom) ───────────────────────────────────────────
  {
    id: "g57",
    file: "/gallery/math-lady-bathroom.png",
    formatName: "Math Lady",
    captionPreview: "COUNTING KIDS BACK FROM THE BATHROOM",
    remixFormatId: "math-lady",
    captions: { top: "Counting kids back from the bathroom" },
    situations: ["classroom-management"],
  },

  // ── Waiting Skeleton (planning) ────────────────────────────────────
  {
    id: "g58",
    file: "/gallery/waiting-skeleton-planning.png",
    formatName: "Waiting Skeleton",
    captionPreview: "ME WAITING / FOR A QUIET PLANNING PERIOD",
    remixFormatId: "waiting-skeleton",
    captions: { top: "Me waiting", bottom: "For a quiet planning period" },
    situations: ["lesson-planning", "last-period-energy"],
  },

  // ── They're the Same Picture (bell) ────────────────────────────────
  {
    id: "g59",
    file: "/gallery/same-picture-bell.png",
    formatName: "They're the Same Picture",
    captionPreview: "LESSON PLAN / AFTER THE BELL RINGS",
    remixFormatId: "same-picture",
    captions: {
      left: "Lesson plan",
      right: "After the bell rings",
      bottom: "They're the same picture",
    },
    situations: ["lesson-planning", "classroom-management"],
  },

  // ── Expanding Brain (reuse) ──────────────────────────────────────────
  {
    id: "g60",
    file: "/gallery/expanding-brain-reuse.png",
    formatName: "Expanding Brain",
    captionPreview:
      "PLAN A LESSON / REUSE LAST YEAR / CALL IT BRAND NEW / THEY TEACH, I 'FACILITATE'",
    remixFormatId: "expanding-brain",
    captions: {
      level1: "Plan a lesson",
      level2: "Reuse last year's lesson",
      level3: "Reuse it, call it brand new",
      level4: "They teach; I 'facilitate'",
    },
    situations: ["lesson-planning"],
  },

  // ── Text variants (g61–g80): same formats, new captions ─────────────

  {
    id: "g61",
    file: "/gallery/distracted-off-topic-question.png",
    formatName: "Distracted Boyfriend",
    captionPreview:
      "ONE OFF-TOPIC QUESTION / ME / LESSON PLAN",
    remixFormatId: "distracted-boyfriend",
    captions: {
      newGirl: "One student asking a completely unrelated question",
      boyfriend: "Me",
      girlfriend: "Lesson plan",
    },
    searchKeywords: ["distraction", "lesson plan", "off topic"],
    situations: ["lesson-planning", "classroom-management"],
  },
  {
    id: "g62",
    file: "/gallery/distracted-pinterest-sunday.png",
    formatName: "Distracted Boyfriend",
    captionPreview: "PINTEREST ANCHOR CHARTS / ME ON SUNDAY / ACTUAL PLANNING",
    remixFormatId: "distracted-boyfriend",
    captions: {
      newGirl: "Anchor charts on Pinterest",
      boyfriend: "Me on Sunday night",
      girlfriend: "Actual lesson planning",
    },
    searchKeywords: ["pinterest", "sunday", "planning"],
    situations: ["lesson-planning"],
  },
  {
    id: "g63",
    file: "/gallery/drake-reading-directions.png",
    formatName: "Drake Yes / No",
    captionPreview:
      "STUDENTS READING DIRECTIONS / STUDENTS ASKING WHAT ARE WE DOING",
    remixFormatId: "drake",
    captions: {
      no: "Students reading directions",
      yes: "Students asking 'what are we doing?'",
    },
    searchKeywords: ["directions", "students"],
    situations: ["students-not-reading"],
  },
  {
    id: "g64",
    file: "/gallery/drake-pencils-down.png",
    formatName: "Drake Yes / No",
    captionPreview: "TIME FOR QUESTIONS / ASKING WHEN I SAY PENCILS DOWN",
    remixFormatId: "drake",
    captions: {
      no: "Using the 5 minutes I gave for questions",
      yes: "Asking the second I say 'pencils down'",
    },
    searchKeywords: ["pencils down", "questions"],
    situations: ["students-not-reading", "classroom-management"],
  },
  {
    id: "g65",
    file: "/gallery/success-kid-45-minutes.png",
    formatName: "Success Kid",
    captionPreview: "PLANNED 45 MINUTES / IT LASTED 45 MINUTES",
    remixFormatId: "success-kid",
    captions: {
      top: "Planned a 45-minute lesson",
      bottom: "It actually lasted 45 minutes",
    },
    searchKeywords: ["lesson timing", "win"],
    situations: ["lesson-planning"],
  },
  {
    id: "g66",
    file: "/gallery/success-kid-real-questions.png",
    formatName: "Success Kid",
    captionPreview: "ASKED WHO HAS QUESTIONS / GOT REAL QUESTIONS",
    remixFormatId: "success-kid",
    captions: {
      top: "Asked who has questions",
      bottom: "Got real questions, not 'can I go to the bathroom'",
    },
    searchKeywords: ["questions", "bathroom"],
    situations: ["classroom-management"],
  },
  {
    id: "g67",
    file: "/gallery/grumpy-planning-days.png",
    formatName: "Grumpy Cat",
    captionPreview: "THREE DAYS OFF / TWO ARE PLANNING DAYS",
    remixFormatId: "grumpy-cat",
    captions: {
      top: "Three days off in a row",
      bottom: "Two of them are 'planning days'",
    },
    searchKeywords: ["break", "planning days"],
    situations: ["lesson-planning", "monday-chaos"],
  },
  {
    id: "g68",
    file: "/gallery/grumpy-sub-left-lunch.png",
    formatName: "Grumpy Cat",
    captionPreview: "SUB PLANS TOOK 2 HOURS / SUB LEFT AT LUNCH",
    remixFormatId: "grumpy-cat",
    captions: {
      top: "Sub plans took 2 hours",
      bottom: "Sub left at lunch",
    },
    searchKeywords: ["substitute", "sub plans"],
    situations: ["lesson-planning", "classroom-management"],
  },
  {
    id: "g69",
    file: "/gallery/disaster-girl-feral.png",
    formatName: "Disaster Girl",
    captionPreview: "WHEN ADMIN WALKS IN / CLASS GOES FERAL",
    remixFormatId: "disaster-girl",
    captions: {
      top: "When admin walks in",
      bottom: "Right as the class goes feral",
    },
    searchKeywords: ["admin", "observation"],
    situations: ["admin-observation", "classroom-management"],
  },
  {
    id: "g70",
    file: "/gallery/disaster-girl-30-seconds.png",
    formatName: "Disaster Girl",
    captionPreview: "LEFT FOR 30 SECONDS / CAME BACK TO A SMALL SOCIETY",
    remixFormatId: "disaster-girl",
    captions: {
      top: "When I left my own classroom for 30 seconds",
      bottom: "And came back to a small society",
    },
    searchKeywords: ["hallway", "chaos"],
    situations: ["classroom-management"],
  },
  {
    id: "g71",
    file: "/gallery/woman-yelling-turn-in.png",
    formatName: "Woman Yelling at Cat",
    captionPreview: "WHY DIDN'T YOU TURN IT IN? / ABSENT 5 MINUTES",
    remixFormatId: "woman-yelling-at-cat",
    captions: {
      woman: "Why didn't you turn it in?",
      cat: "I was absent... for 5 minutes",
    },
    searchKeywords: ["turn in", "homework", "absent"],
    situations: ["students-not-reading", "grading-pile"],
  },
  {
    id: "g72",
    file: "/gallery/woman-yelling-syllabus-august.png",
    formatName: "Woman Yelling at Cat",
    captionPreview: "SYLLABUS SINCE AUGUST? / NEVER SAW THIS DOCUMENT",
    remixFormatId: "woman-yelling-at-cat",
    captions: {
      woman: "Where is the syllabus you've had since August?",
      cat: "I've literally never seen this document",
    },
    searchKeywords: ["syllabus", "august"],
    situations: ["students-not-reading"],
  },
  {
    id: "g73",
    file: "/gallery/this-is-fine-ungraded.png",
    formatName: "This Is Fine",
    captionPreview: "STACK OF UNGRADED PAPERS / THIS IS FINE.",
    remixFormatId: "this-is-fine",
    captions: {
      top: "Stack of ungraded papers",
      bottom: "This is fine.",
    },
    searchKeywords: ["grading", "papers"],
    situations: ["grading-pile"],
  },
  {
    id: "g74",
    file: "/gallery/this-is-fine-lesson-plans.png",
    formatName: "This Is Fine",
    captionPreview: "LESSON PLANS DUE TOMORROW / THIS IS FINE.",
    remixFormatId: "this-is-fine",
    captions: {
      top: "Lesson plans due tomorrow, I have not started",
      bottom: "This is fine.",
    },
    searchKeywords: ["lesson plans", "tomorrow"],
    situations: ["lesson-planning", "monday-chaos"],
  },
  {
    id: "g75",
    file: "/gallery/pikachu-test-tomorrow.png",
    formatName: "Surprised Pikachu",
    captionPreview: "TEST IS TOMORROW / STUDENTS DIDN'T STUDY",
    remixFormatId: "surprised-pikachu",
    captions: {
      top: "Teacher: 'The test is tomorrow'",
      bottom: "Students didn't study",
    },
    searchKeywords: ["test", "study"],
    situations: ["students-not-reading", "grading-pile"],
  },
  {
    id: "g76",
    file: "/gallery/pikachu-homework-clueless.png",
    formatName: "Surprised Pikachu",
    captionPreview: "TALKED ALL PERIOD / NO IDEA WHAT THE HOMEWORK IS",
    remixFormatId: "surprised-pikachu",
    captions: {
      top: "Talks the whole class period",
      bottom: "Has no idea what the homework is",
    },
    searchKeywords: ["homework", "clueless"],
    situations: ["students-not-reading"],
  },
  {
    id: "g77",
    file: "/gallery/spongebob-real-life-meme.png",
    formatName: "Mocking SpongeBob",
    captionPreview: "STUDENTS / WHEN ARE WE GONNA USE THIS IN REAL LIFE",
    remixFormatId: "mocking-spongebob",
    captions: {
      top: "Students:",
      bottom: "When are we ever gonna use this in real life",
    },
    searchKeywords: ["real life", "spongebob"],
    situations: ["students-not-reading"],
  },
  {
    id: "g78",
    file: "/gallery/harold-love-my-job.png",
    formatName: "Hide the Pain Harold",
    captionPreview: "I LOVE MY JOB / EXPLAINING IT FOR THE 3RD TIME",
    remixFormatId: "hide-the-pain-harold",
    captions: {
      top: "I love my job",
      bottom: "*3rd time explaining the same thing*",
    },
    searchKeywords: ["explaining", "repeat"],
    situations: ["students-not-reading", "classroom-management"],
  },
  {
    id: "g79",
    file: "/gallery/harold-another-committee.png",
    formatName: "Hide the Pain Harold",
    captionPreview: "HAPPY TO JOIN ANOTHER COMMITTEE / FIVE SECONDS FROM BREAKDOWN",
    remixFormatId: "hide-the-pain-harold",
    captions: {
      top: "Of course, I'd be happy to take on another committee",
      bottom: "I am five seconds from a breakdown",
    },
    searchKeywords: ["committee", "admin"],
    situations: ["admin-observation", "monday-chaos"],
  },
  {
    id: "g80",
    file: "/gallery/two-buttons-review-day.png",
    formatName: "Two Buttons",
    captionPreview:
      "STUDY FOR THE TEST / SKIP REVIEW DAY / ME",
    remixFormatId: "two-buttons",
    captions: {
      button1: "Study for the test",
      button2: "Skip review day",
      person: "Me",
    },
    searchKeywords: ["test", "review"],
    situations: ["lesson-planning", "students-not-reading"],
  },
];

// Map source AI-generated filename → final gallery file name.
// The build script (scripts/build-gallery.mjs) uses this to know
// which input → output to watermark.
export const gallerySourceMap = {
  "meme-boromir-backup.png": "boromir-backup.png",
  "meme-drake-engaging.png": "drake-engaging.png",
  "meme-distracted-boyfriend-teacher.png": "distracted-boyfriend-off-topic.png",
  "meme-distracted-boyfriend-grading.png": "distracted-boyfriend-grading.png",
  "meme-harold-explaining.png": "harold-explaining.png",
  "meme-harold-committee.png": "harold-committee.png",
  "meme-this-is-fine-emails.png": "this-is-fine-emails.png",
  "meme-this-is-fine-iep.png": "this-is-fine-urgent.png",
  "meme-disaster-girl-admin.png": "disaster-girl-admin.png",
  "meme-success-kid-grades.png": "success-kid-grades.png",
  "meme-spongebob-real-life.png": "spongebob-real-life.png",
  "meme-spongebob-work-life.png": "spongebob-work-life.png",
  "meme-side-eye-sub.png": "side-eye-sub.png",
  "meme-crying-cat-papers.png": "crying-cat-papers.png",
  "meme-two-buttons-sleep.png": "two-buttons-sleep.png",
  "meme-grumpy-cat-plans.png": "grumpy-cat-plans.png",
  "meme-doge-grading.png": "doge-grading.png",
  "meme-expanding-brain-homework.png": "expanding-brain-homework.png",
  "meme-woman-yelling-cat-turn-in.png": "woman-yelling-cat-turn-in.png",
  "meme-change-my-mind-group-work.png": "change-my-mind-group-work.png",
  "meme-pigeon-learner.png": "pigeon-tuesday.png",
  "meme-pepe-grading-midnight.png": "pepe-grading-midnight.png",
  "meme-buff-doge-cheems-school-year.png": "buff-doge-cheems-school-year.png",
  "meme-y-u-no-syllabus.png": "y-u-no-syllabus.png",
  "meme-galaxy-brain-syllabus.png": "galaxy-brain-syllabus.png",
  "meme-they-dont-know-tired.png": "they-dont-know-tired.png",
  "meme-stonks-laminator.png": "stonks-laminator.png",
  "meme-first-world-copier.png": "first-world-copier.png",
  "meme-trade-offer-planning.png": "trade-offer-planning.png",
  "meme-wojak-chad-summer.png": "wojak-chad-summer.png",
  "meme-anakin-padme-reinvent.png": "anakin-padme-reinvent.png",
  "meme-awkward-monkey-when-will-we-use.png":
    "awkward-monkey-when-will-we-use.png",
  "meme-squidward-first-year-teachers.png": "squidward-first-year-teachers.png",
  "meme-conspiracy-board-bell-schedule.png":
    "conspiracy-board-bell-schedule.png",
  "meme-hard-to-swallow-homework.png": "hard-to-swallow-homework.png",
  "meme-crying-wojak-differentiate.png": "crying-wojak-differentiate.png",
  "meme-drake-alt-winging-it.png": "drake-alt-winging-it.png",
  "meme-sweating-athlete-worksheet.png": "sweating-athlete-worksheet.png",
  "meme-math-lady-chromebooks.png": "math-lady-chromebooks.png",
  "meme-waiting-skeleton-it-ticket.png": "waiting-skeleton-it-ticket.png",
  "meme-same-picture-group-work.png": "same-picture-group-work.png",
  "meme-doomer-parent-conferences.png": "doomer-parent-conferences.png",
};

export function getGalleryItemById(id) {
  return galleryItems.find((g) => g.id === id) || null;
}

export const gallerySituationFilters = [
  { id: "monday-chaos", label: "Monday Chaos", emoji: "😩" },
  { id: "lesson-planning", label: "Lesson Planning", emoji: "📓" },
  { id: "grading-pile", label: "Grading Pile", emoji: "📑" },
  { id: "students-not-reading", label: "Directions, ignored", emoji: "🙃" },
  { id: "admin-observation", label: "Admin Observation", emoji: "📋" },
  { id: "group-work", label: "Group Work", emoji: "👥" },
  { id: "differentiation", label: "Differentiation", emoji: "🧩" },
  { id: "classroom-management", label: "Classroom Mgmt", emoji: "🚦" },
  { id: "last-period-energy", label: "Last Period", emoji: "⏰" },
  { id: "all", label: "All", emoji: "✨" },
];
