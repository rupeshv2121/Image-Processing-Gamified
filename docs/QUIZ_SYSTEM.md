# ImageLab — Quiz System and Gamification

## Question bank — `quizzes/questionBank.m`

About 90 questions. Each question is a struct:

| Field | Meaning |
|---|---|
| id | e.g. `NON1` |
| category | Fundamentals, Histogram, Spatial Filters, Linear Filters, Non-Linear Filters, Noise, Correlation, Convolution, Sharpening, Edge Detection, Segmentation, Color Processing |
| difficulty | easy / medium / hard |
| type | mcq, truefalse, kernel, output, numerical, conceptual |
| question, options, answer | answer is the 1-based index of the correct option |
| explanation | shown after answering |
| kernel | matrix shown with "identify the kernel" questions (or []) |

To add a question, add one line in `questionBank.m`:

```matlab
Q = add(Q, 'NON9', 'Non-Linear Filters', 'easy', 'mcq', ...
    'Which rank of a 3x3 window gives the maximum?', {'1', '5', '9', '3'}, 3, ...
    'The window has 9 values; rank 9 is the largest.');
```

## Engine — `quizzes/quizEngine.m`

* `quizEngine('select', difficulty, categories, n)` — random questions. If too few questions exist at
  that difficulty, it tops up from the other difficulties. Options are shuffled.
* `quizEngine('kernel', n)` — generates "identify the kernel" questions from `kernelPresets.m`.
* `quizEngine('score', results)` — per correct answer: **100 × difficulty multiplier** (easy 1, medium
  1.5, hard 2) **+ 5 × seconds left + 10 × (streak − 1)**. Returns score, accuracy and best streak.

## Modes

| Mode | Description |
|---|---|
| Rapid Fire | 5/10/15 questions, 10 s timer, score, streak, accuracy, progress bars |
| Kernel Quiz | A kernel is displayed: Mean, Sobel X/Y, Prewitt X/Y, Laplacian, Sharpening … |
| Guess the Filter | MATLAB applies a random filter (mean, median, Gaussian, Laplacian, Sobel, Prewitt) |
| Build the Pipeline | `pipelineProblems.m`: e.g. "Remove noise and improve contrast" → Median → CLAHE |
| Challenge Mode | Timed restoration; score = 40·ΔPSNR + 600·ΔSSIM + time bonus |
| Classroom Mode | Projector layout, big timer, reveal and explanation, class score |

## Leaderboard — `quizzes/leaderboardManager.m`

A MATLAB `table` (Name, Roll, Score, Accuracy, BestStreak, Mode, Date) saved in
`quizzes/leaderboard.mat`, sorted by score and then accuracy. If the file is corrupted, a new one is
started.

## Progress, XP and badges — `quizzes/progressManager.m`

Saved in `data/userProgress.mat`.

| Event | XP |
|---|---|
| Trying something new (filter, noise model, edge detector …) | +10 |
| Completing a Learn topic | +20 |
| Completing an experiment | +50 |
| Finishing a quiz | score / 10 |
| Earning a badge | +100 |

Level = ⌊√(XP/100)⌋ + 1.

| Badge | Condition |
|---|---|
| Filter Master | 6 different spatial filters |
| Noise Fighter | 3 noise models + a filter comparison |
| Histogram Hero | 4 histogram methods |
| Convolution Expert | correlation, convolution and the kernel playground |
| Edge Detective | 4 edge detectors |
| Segmentation Pro | 4 segmentation methods |
| Colour Artist | 3 colour models |
| Perfect Quiz | 10/10 |
| Streak Master | streak of 5 |
| Experimenter | 5 experiments |
| Scholar | 8 Learn topics |
| Quiz Regular | 5 quizzes |

Topics are classed as weak (< 60 % accuracy) or strong (≥ 80 %) per category once at least
2 questions have been answered.
