# Lesson JSON Format Specification

## 📖 Overview

This document serves as the **authoritative guide** for creating and formatting lesson files in JSON format. All lessons must follow this structure to ensure proper loading, rendering, and user experience.

### 📱 Mobile-First Design

**CRITICAL**: All lessons are primarily displayed on mobile devices. Optimize all content for small screens:
- Keep step titles concise (3-4 words)
- Limit tables to 3 columns maximum
- Use short paragraphs
- Test readability on mobile viewport

---

## 🗂️ Directory Structure

```
lessons/
├── README.md (this file)
├── {language_code}/
│   ├── {unit_directory}/
│   │   ├── _unit_metadata.json
│   │   ├── 01_lesson_name.json
│   │   ├── 02_lesson_name.json
│   │   └── ...
│   └── ...
└── ...
```

### Language Codes
Use ISO 639-1 two-letter codes:
- `ml` = Malayalam
- `kn` = Kannada
- `ta` = Tamil
- `te` = Telugu
- `hi` = Hindi
- etc.

### Unit Directory Naming
Format: `unit_{number}_{short_description}`
- Example: `unit_1_foundations`, `unit_2_conversations`
- Use lowercase with underscores

### Lesson File Naming
Format: `{number}_{descriptive_name}.json`
- Number should be zero-padded (01, 02, 03, etc.)
- Use lowercase with underscores
- Example: `01_the_a_starters.json`, `10_the_heavy_chillus.json`

---

## 📄 Lesson JSON Schema

### Top-Level Structure

```json
{
  "lesson_id": "string (required)",
  "language": "string (required)",
  "title": "string (required)",
  "subtitle": "string (optional)",
  "description": "string (required)",
  "estimated_minutes": number (required),
  "cefr_level": "string (required)",
  "tags": ["array of strings (required)"],
  "skills_learned": ["array of strings (required)"],
  "steps": [array of step objects (required)]
}
```

### Field Descriptions

#### `lesson_id` (string, **required**)
- **Format**: `{language_code}_{lesson_number}_{short_name}`
- **Example**: `"ml_01_the_a_starters"`, `"ml_10_heavy_chillus"`
- **Purpose**: Unique identifier for database lookups
- **Rules**:
  - Must be globally unique across all lessons
  - Use underscores, no spaces
  - Include language code prefix
  - Keep it concise but descriptive

#### `language` (string, **required**)
- **Format**: Full language name (capitalized)
- **Examples**: `"Malayalam"`, `"Kannada"`, `"Tamil"`
- **Note**: This is the display name, not the ISO code

#### `title` (string, **required**)
- **Format**: Short, descriptive title (2-6 words)
- **Examples**: `"The 'A' Starters"`, `"The Heavy Chillus"`
- **Purpose**: Main lesson heading shown in UI
- **Rules**:
  - Use title case
  - Should be engaging and descriptive
  - Can include emojis in description, but title should be clean

#### `subtitle` (string, optional but **recommended**)
- **Format**: Brief clarification or key content preview
- **Examples**: `"അ, ക, റ, മ - Your First Four Letters"`, `"ൾ, ൺ - Retroflex L and N Endings"`
- **Purpose**: Gives learners immediate context about lesson content
- **Rules**:
  - Can include native script characters
  - Keep under 60 characters

#### `description` (string, **required**)
- **Format**: 1-2 sentences explaining lesson goals
- **Example**: `"Learn to read Malayalam script phonetically. Master the visual recognition and pronunciation of these characters."`
- **Purpose**: Displayed in lesson selection UI, helps users choose
- **Rules**:
  - Be clear and specific about learning outcomes
  - Use action verbs (Learn, Master, Practice, etc.)
  - 100-200 characters ideal

#### `estimated_minutes` (number, **required**)
- **Format**: Integer representing completion time
- **Example**: `25`, `30`, `15`
- **Purpose**: Helps users plan their study sessions
- **Rules**:
  - Based on average learner pace (not experts or complete beginners)
  - Include time for reading, questions, and reflection
  - Typical range: 15-35 minutes

#### `cefr_level` (string, **required**)
- **Format**: CEFR scale level
- **Valid values**: `"A0"`, `"A1"`, `"A2"`, `"B1"`, `"B2"`, `"C1"`, `"C2"`
- **Purpose**: Indicates difficulty level
- **Common usage**:
  - `A0` = Absolute beginner (script basics)
  - `A1` = Elementary (basic conversations)
  - `A2` = Pre-intermediate
  - `B1+` = Intermediate and above

#### `tags` (array of strings, **required**)
- **Format**: Array of lowercase descriptive tags
- **Examples**: `["script", "vowels", "consonants", "basics"]`, `["chillus", "retroflexes", "endings"]`
- **Purpose**: Categorization, search, skill tracking
- **Rules**:
  - Use 3-6 tags per lesson
  - Be specific and consistent across lessons
  - Common tags: `script`, `vowels`, `consonants`, `pronunciation`, `vocabulary`, `grammar`, `reading`, `listening`

#### `skills_learned` (array of strings, **required**)
- **Format**: Array of specific skills gained from this lesson
- **Examples**: `["Reading അ character", "Pronouncing retroflex R", "Writing basic words"]`
- **Purpose**: Clear learning outcomes, skill tracking, progress visualization
- **Rules**:
  - List 3-5 concrete skills per lesson
  - Use action verbs (Reading, Writing, Recognizing, Pronouncing, etc.)
  - Be specific to this lesson's content
  - Focus on measurable outcomes

---

## 📝 Steps Array

The `steps` array contains the lesson content, structured as a sequence of learning activities. Each step is an object with a specific type.

### Step Types Overview

1. **`content`** - Instructional text with markdown
2. **`multiple_choice`** - Question with 2-6 options
3. **`free_response`** - Open-ended text input question

---

## 🎯 Step Type 1: Content

Used for teaching concepts, explanations, examples, and context.

### Schema

```json
{
  "type": "content",
  "content_markdown": "string (required)",
  "step_title": "string (required)"
}
```

### Field Details

#### `content_markdown` (string, **required**)
- **Format**: Markdown-formatted text
- **Supported markdown**:
  - Headers: `#`, `##`, `###`
  - Bold: `**text**`
  - Italic: `*text*`
  - Lists: `- item` or `1. item`
  - Tables: Standard markdown table syntax
  - Code/special notation: Inline backticks or `$notation$`
- **Rules**:
  - Use clear hierarchy with headers
  - Break long content into sections
  - Include examples when teaching new concepts
  - Use native script characters naturally
  - Emojis are acceptable for engagement

#### `step_title` (string, **required**)
- **Format**: Short descriptive name (**3-4 words ideal**)
- **Examples**: 
  - `"Welcome to Malayalam"` (3 words)
  - `"Letter അ (a)"` (3 words)
  - `"Retroflex L Sound"` (3 words)
  - `"Build Your Words"` (3 words)
- **Purpose**: Shown in lesson sidebar navigation on mobile
- **Rules**:
  - **CRITICAL**: Keep to 3-4 words for mobile display
  - Should be unique within the lesson
  - Descriptive enough to identify the section
  - Avoid emojis in step titles (use in content instead)
  - Must fit on mobile sidebar without wrapping
  - Extract key concept from section, not full heading

### Content Writing Tips

1. **Start with context**: Tell learners what they'll achieve
2. **Use visual memory tricks**: Help learners remember character shapes
3. **Provide examples**: Show real words using new concepts
4. **Break into digestible chunks**: Use headers and lists
5. **Progressive difficulty**: Build on previous knowledge
6. **Cultural context**: Include interesting facts about language/culture

### Example

```json
{
  "type": "content",
  "content_markdown": "## Letter 1: അ (a)\n\n### Shape & Sound\n**അ** is pronounced like the 'a' in *about* or *sofa* - a short, neutral vowel.\n\n### Visual Memory Trick\nThink of it like a sideways **chair** (അ) - simple and foundational!\n\n### In Words\n- **അമ്മ** (amma) = Mother\n- **അറ** (aRa) = Room\n- **അര** (ara) = Waist",
  "step_title": "Letter 1: അ (a)"
}
```

---

## ❓ Step Type 2: Multiple Choice

Used for comprehension checks, concept reinforcement, and assessment.

### Schema

```json
{
  "type": "multiple_choice",
  "id": "string (required)",
  "question": "string (required)",
  "options": ["array of strings (required, 2-6 items)"],
  "correct_answer": "string (required, must match an option exactly)",
  "feedback": "string (required)",
  "step_title": "string (required)"
}
```

### Field Details

#### `id` (string, **required**)
- **Format**: Short unique identifier within lesson
- **Example**: `"q1"`, `"q2"`, `"q3"`, `"check_pronunciation"`
- **Purpose**: Used for tracking user responses and progress
- **Rules**:
  - Must be unique within the lesson
  - Use lowercase, underscores allowed
  - Keep simple: `q1`, `q2`, etc. is perfectly fine

#### `question` (string, **required**)
- **Format**: Clear, specific question
- **Examples**:
  - `"What sound does **അ** make?"`
  - `"How is റ (Ra) pronounced differently from English 'r'?"`
  - `"What's the difference between ൻ and ൺ?"`
- **Rules**:
  - Be specific and unambiguous
  - Can use markdown (bold, italic) for emphasis
  - Can include native script characters
  - Avoid trick questions - test understanding, not memory

#### `options` (array, **required**)
- **Format**: 2-6 answer choices (typically 4)
- **Rules**:
  - All options should be plausible
  - Avoid "all of the above" or "none of the above"
  - One option must exactly match `correct_answer`
  - Order matters (randomization happens in app)
  - Can use markdown formatting
  - Length should be roughly similar across options

#### `correct_answer` (string, **required**)
- **Format**: Must **exactly match** one option (case-sensitive)
- **Critical**: String comparison is exact, including spaces and punctuation
- **Example**: If option is `"Like 'a' in 'about' (short neutral vowel)"`, the correct_answer must be identical

#### `feedback` (string, **required**)
- **Format**: Positive reinforcement + brief explanation
- **Examples**:
  - `"Perfect! അ is a short, neutral 'a' sound - the foundation of Malayalam phonetics."`
  - `"Excellent! Malayalam distinguishes these two 'L' sounds precisely!"`
  - `"Correct! മ = ma. Remember the inherent 'a' in every consonant!"`
- **Purpose**: Reinforces learning even when correct
- **Rules**:
  - Start with positive words: Perfect!, Excellent!, Correct!, Great!
  - Add a brief explanation or reminder
  - Keep under 150 characters
  - Don't repeat the full question

#### `step_title` (string, **required**)
- **Format**: Short version of the question (**3-4 words**)
- **Examples**:
  - `"Sound of അ"` (3 words)
  - `"Inherent 'a' Concept"` (3 words)
  - `"Malayalam N Sounds"` (3 words)
- **Rules**:
  - **CRITICAL**: 3-4 words for mobile sidebar
  - Extract key concept from question
  - Don't use full question text
  - Must be clear at a glance on mobile

### Multiple Choice Best Practices

1. **Test understanding, not memorization**: Ask "why" or "how" questions
2. **One clear correct answer**: Avoid ambiguity
3. **Plausible distractors**: Wrong answers should be believable
4. **Immediate feedback**: Use feedback to reinforce concepts
5. **Strategic placement**: After introducing new concepts
6. **Varied difficulty**: Mix recall and application questions

### Example

```json
{
  "type": "multiple_choice",
  "id": "q3",
  "question": "How is റ (Ra) pronounced differently from English 'r'?",
  "options": [
    "It's a strong, trilled 'r' with tongue vibration (like Spanish 'rr')",
    "It's exactly the same as English 'r'",
    "It's silent",
    "It sounds like 'l'"
  ],
  "correct_answer": "It's a strong, trilled 'r' with tongue vibration (like Spanish 'rr')",
  "feedback": "Perfect! റ is the HARD trilled R ($R$). Malayalam has precise sound distinctions!",
  "step_title": "How is റ (Ra) pronounced differe..."
}
```

---

## ✍️ Step Type 3: Free Response

Used for production practice where learners actively generate answers.

### Schema

```json
{
  "type": "free_response",
  "id": "string (required)",
  "question": "string (required)",
  "ai_grading": boolean (required),
  "accepted_responses": ["array of strings (optional, used when ai_grading=false)"],
  "hint": "string (optional)",
  "step_title": "string (required)"
}
```

### Field Details

#### `id` (string, **required**)
- Same rules as multiple choice `id`

#### `question` (string, **required**)
- **Format**: Clear instruction or question
- **Examples**:
  - `"Write the Malayalam word for 'Mother' in English letters (using the letters you learned today)"`
  - `"Transliterate the word **കേരളം** into English letters"`
- **Rules**:
  - Be explicit about expected format (English letters, Malayalam script, etc.)
  - Specify if case matters
  - Provide context if needed

#### `ai_grading` (boolean, **required**)
- **Values**: `true` or `false`
- **Purpose**: Determines how answer is evaluated
- **When to use `false`**: Simple, exact-match answers (single words, numbers)
- **When to use `true`**: Complex answers requiring interpretation (not yet implemented)
- **Current implementation**: Always use `false` with `accepted_responses`

#### `accepted_responses` (array, **required when ai_grading=false**)
- **Format**: Array of acceptable answer strings
- **Rules**:
  - Include common variations (case, spelling, transliteration)
  - Order doesn't matter
  - Comparison is typically case-insensitive
  - Be generous with variations
- **Example**: `["amma", "Amma", "AMMA"]`

#### `hint` (string, optional but **recommended**)
- **Format**: Helpful clue without giving away the answer
- **Example**: `"It uses the letter മ twice, with a special symbol in between. The word sounds like 'amma'."`
- **Purpose**: Assists struggling learners without frustration
- **Rules**:
  - Not shown immediately
  - Provide direction, not the answer
  - Reference concepts from earlier in the lesson

#### `step_title` (string, **required**)
- Same rules as other step types
- Typically a shortened version of the question

### Free Response Best Practices

1. **Start simple**: Begin with word/sound reproduction before complex generation
2. **Clear expectations**: Tell learners exactly what format to use
3. **Accept variations**: Include all reasonable spellings/transliterations
4. **Provide hints**: Don't let learners get stuck
5. **Strategic placement**: After teaching and practice
6. **Validate early**: Test that your accepted_responses cover common answers

### Example

```json
{
  "type": "free_response",
  "id": "q5",
  "question": "Write the Malayalam word for 'Mother' in English letters (using the letters you learned today)",
  "ai_grading": false,
  "accepted_responses": [
    "amma",
    "Amma",
    "AMMA"
  ],
  "hint": "It uses the letter മ twice, with a special symbol in between. The word sounds like 'amma'.",
  "step_title": "Write the Malayalam word for 'Mo..."
}
```

---

## 🎨 Formatting Conventions

### Phonetic Notation

Use `$` symbols to denote special phonetic characters:
- `$R$` = Hard/trilled retroflex R (റ)
- `$L$` = Retroflex L (ള)
- `$N$` = Retroflex N (ണ)
- `$r$` = Soft/standard R (ര)
- `$l$` = Standard L (ല)
- `$n$` = Dental N (ന)
- `$ng$` = Velar/nasal NG (ങ)

**Purpose**: Distinguishes similar sounds in English transliteration

**Example**: 
- "കറ (kaRa)" vs "കര (kara)" - shows the different R sounds
- "പാൾ (paaL)" vs "പാൽ (paal)" - shows the different L sounds

### Markdown Tables

Tables are fully supported and useful for vocabulary lists:

```markdown
| Malayalam | Sound | Meaning |
|-----------|-------|---------|
| **അറ** | aRa | room |
| **കര** | kara | land |
| **മറ** | maRa | cover |
```

**Rules**:
- **CRITICAL**: Limit to **3 columns maximum** for mobile rendering
- Use standard markdown table syntax
- Include headers
- Keep columns aligned for readability in source
- Keep header names short (1-2 words)
- Common 3-column pattern: Native script | Transliteration | Meaning
- Avoid complex nested content in cells
- Test on mobile viewport before finalizing

### Native Script Usage

- **Always include native script** alongside transliteration when teaching
- **Use bold** for emphasis: `**അ**`
- **Provide pronunciation guide** in parentheses: `**അ** (a)`
- **Example format**: `**കേരളം** (keraLam) = Kerala`

### Emoji Usage

- **Acceptable in content and titles** for engagement
- **Common usage**: 🎉 📚 🏗️ 💪 ✅ 🌟 🎯
- **Don't overuse**: 1-2 per content step maximum
- **Avoid in questions**: Keep questions professional

---

## 📚 Unit Metadata File

Each unit directory must contain a `_unit_metadata.json` file.

### Schema

```json
{
  "unit_id": "string (required)",
  "unit_number": number (required),
  "language": "string (required)",
  "title": "string (required)",
  "subtitle": "string (optional)",
  "description": "string (required)",
  "estimated_minutes": number (required, sum of all lessons),
  "lesson_count": number (required),
  "lessons": ["array of lesson file names without .json (required)"],
  "completion_criteria": {
    "all_lessons_completed": true
  },
  "skills_learned": ["array of strings (optional)"]
}
```

### Field Descriptions

#### `unit_id` (string, **required**)
- **Format**: `{language_code}_unit_{number}`
- **Example**: `"ml_unit_1"`, `"kn_unit_2"`

#### `unit_number` (number, **required**)
- **Format**: Integer starting from 1
- **Example**: `1`, `2`, `3`

#### `language` (string, **required**)
- Full language name: `"Malayalam"`, `"Kannada"`, etc.

#### `title` (string, **required**)
- **Format**: Short, descriptive unit name
- **Example**: `"Reading Malayalam"`, `"Conversational Basics"`

#### `subtitle` (string, optional)
- **Format**: Additional context
- **Example**: `"Complete Script Mastery"`

#### `description` (string, **required**)
- **Format**: 1-3 sentences about unit objectives
- **Example**: `"Master the entire Malayalam script from basic vowels to advanced character combinations. Learn to read any Malayalam text with confidence through 30 progressive lessons."`

#### `estimated_minutes` (number, **required**)
- Total time for all lessons in unit
- Should equal sum of individual lesson times

#### `lesson_count` (number, **required**)
- Total number of lessons in unit
- Must match length of `lessons` array

#### `lessons` (array, **required**)
- **Format**: Ordered list of lesson filenames WITHOUT `.json` extension
- **Example**: `["01_the_a_starters", "02_the_nasalizer_and_long_a", ...]`
- **Rules**:
  - Order determines sequence in UI
  - Must match actual lesson files in directory
  - Use underscore format

#### `completion_criteria` (object, **required**)
- Currently simple: `{"all_lessons_completed": true}`
- Future: May include quizzes, time requirements, etc.

#### `skills_learned` (array, optional but **recommended**)
- **Format**: List of specific skills gained
- **Example**: 
  ```json
  [
    "All Malayalam vowels and consonants",
    "Vowel modifiers and diacritics",
    "Consonant clusters and conjuncts"
  ]
  ```

### Example Unit Metadata

```json
{
  "unit_id": "ml_unit_1",
  "unit_number": 1,
  "language": "Malayalam",
  "title": "Reading Malayalam",
  "subtitle": "Complete Script Mastery",
  "description": "Master the entire Malayalam script from basic vowels to advanced character combinations. Learn to read any Malayalam text with confidence through 30 progressive lessons.",
  "estimated_minutes": 740,
  "lesson_count": 30,
  "lessons": [
    "01_the_a_starters",
    "02_the_nasalizer_and_long_a",
    "03_the_dental_and_labial_set"
  ],
  "completion_criteria": {
    "all_lessons_completed": true
  },
  "skills_learned": [
    "All Malayalam vowels and consonants",
    "Vowel modifiers and diacritics",
    "Consonant clusters and conjuncts"
  ]
}
```

---

## ✅ Validation Checklist

Before adding a new lesson, verify:

### Lesson File
- [ ] File name follows format: `{number}_{name}.json`
- [ ] `lesson_id` is unique and follows format
- [ ] All required top-level fields present
- [ ] `estimated_minutes` is reasonable (15-35 typical)
- [ ] `cefr_level` is valid
- [ ] `tags` array has 3-6 relevant tags
- [ ] `skills_learned` array has 3-5 specific skills
- [ ] `steps` array has at least 5 steps

### Steps
- [ ] Every step has `type` and `step_title`
- [ ] All `step_title` fields are 3-4 words (mobile optimized)
- [ ] Content steps have meaningful markdown
- [ ] Tables limited to 3 columns maximum
- [ ] Multiple choice questions have exactly one correct answer
- [ ] `correct_answer` exactly matches an option
- [ ] Free response has `accepted_responses` if `ai_grading` is false
- [ ] All `step_title` fields are descriptive and unique within lesson

### Content Quality
- [ ] Lesson has clear learning objective
- [ ] Content builds progressively
- [ ] Examples use real, relevant words
- [ ] Questions test understanding, not just recall
- [ ] Feedback is positive and reinforcing
- [ ] Native script appears alongside transliteration
- [ ] Markdown formatting is correct (no broken tables)
- [ ] All content tested on mobile viewport
- [ ] Tables render properly on small screens (3 columns max)

### Unit Integration
- [ ] Lesson is listed in `_unit_metadata.json` `lessons` array
- [ ] Lesson order makes pedagogical sense
- [ ] Unit `lesson_count` is updated
- [ ] Unit `estimated_minutes` includes new lesson time

---

## 🔧 Common Mistakes to Avoid

1. **Mismatched correct_answer**: Ensure exact string match with option
2. **Missing step_title**: Every step must have a descriptive title
3. **Long step_titles**: Must be 3-4 words for mobile display
4. **Wide tables**: More than 3 columns breaks mobile layout
5. **Inconsistent phonetic notation**: Use `$R$`, `$L$`, etc. consistently
6. **Broken markdown tables**: Test table rendering, avoid stacked Malayalam characters
7. **Non-unique IDs**: Lesson IDs and question IDs must be unique
8. **Wrong ai_grading value**: Use `false` for simple exact-match questions
9. **Missing accepted_responses**: Required when `ai_grading` is false
10. **Missing skills_learned**: Every lesson must list specific skills
11. **Forgetting unit metadata**: Update `_unit_metadata.json` when adding lessons
12. **Poor question feedback**: Always provide positive, educational feedback
13. **Not testing on mobile**: Always verify mobile rendering before committing

---

## 🚀 Loading Lessons

Lessons are loaded via `reload_lessons_with_units.py`:

```bash
python3 reload_lessons_with_units.py
```

This script:
1. Scans `lessons/` directory for language folders
2. Finds units by looking for `_unit_metadata.json`
3. Loads each lesson file in order
4. Inserts/updates database records
5. Reports success/errors

**Before committing**: Always reload lessons and verify no errors!

---

## 📖 Additional Resources

- **Markdown Guide**: https://www.markdownguide.org/basic-syntax/
- **CEFR Levels**: https://en.wikipedia.org/wiki/Common_European_Framework_of_Reference_for_Languages
- **ISO 639-1 Codes**: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes

---

## 🎓 Best Practices Summary

### Pedagogical
1. **Spiral curriculum**: Revisit concepts with increasing complexity
2. **Active learning**: Alternate content with questions
3. **Immediate feedback**: Every question provides learning moment
4. **Authentic materials**: Use real words and practical examples
5. **Cultural context**: Integrate language with culture

### Technical
1. **Consistent formatting**: Follow conventions exactly
2. **Descriptive naming**: Make titles and IDs meaningful
3. **Robust validation**: Test accepted responses thoroughly
4. **Clean markdown**: Preview rendered output
5. **Version control**: Commit working lessons incrementally

### User Experience
1. **Clear objectives**: Learners should know what they'll achieve
2. **Progressive difficulty**: Build confidence before challenging
3. **Visual aids**: Use native script, tables, formatting
4. **Encouraging tone**: Positive feedback, helpful hints
5. **Reasonable length**: 15-30 minutes per lesson ideal

---

## 📝 Template

Use this template for new lessons:

```json
{
  "lesson_id": "LANGUAGE_NUMBER_NAME",
  "language": "LANGUAGE_NAME",
  "title": "LESSON_TITLE",
  "subtitle": "BRIEF_CONTEXT",
  "description": "Clear description of what learners will achieve in this lesson.",
  "estimated_minutes": 25,
  "cefr_level": "A0",
  "tags": ["tag1", "tag2", "tag3"],
  "skills_learned": [
    "Specific skill 1",
    "Specific skill 2",
    "Specific skill 3"
  ],
  "steps": [
    {
      "type": "content",
      "content_markdown": "# Welcome!\n\nIntroductory content...",
      "step_title": "Lesson Welcome"
    },
    {
      "type": "multiple_choice",
      "id": "q1",
      "question": "What is X?",
      "options": [
        "Correct answer",
        "Plausible distractor 1",
        "Plausible distractor 2",
        "Plausible distractor 3"
      ],
      "correct_answer": "Correct answer",
      "feedback": "Perfect! Brief explanation.",
      "step_title": "Understanding X"
    },
    {
      "type": "free_response",
      "id": "q2",
      "question": "Write the word for 'example' in English letters",
      "ai_grading": false,
      "accepted_responses": ["example", "Example", "EXAMPLE"],
      "hint": "Think about the letters you learned...",
      "step_title": "Write Example Word"
    }
  ]
}
```

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Maintainer**: Language Learning Project Team

---

*This README is the single source of truth for lesson formatting. When in doubt, refer to existing Malayalam lessons in `ml/unit_1_foundations/` as reference implementations.*
