# PocketFlow Structured Output Tutorial

Extract structured data from unstructured text using PocketFlow and OpenAI's GPT-4. This tutorial provides two approaches: a learning-focused manual implementation and a production-ready solution using Instructor.js.

## Two Approaches

### 📚 **Learning Version** (`main.ts`)
- **Manual JSON parsing** - See how structured extraction works under the hood
- **Schema function approach** - Understand the core concepts
- **Educational focus** - Perfect for learning PocketFlow and structured output basics

### 🚀 **Production Version** (`main-instructor.ts`)  
- **Type-safe with Zod** - Schema validation and TypeScript inference
- **Instructor.js integration** - Robust, battle-tested structured output
- **Production-ready** - Automatic validation, error handling, and reliability

## Features

- **Structured Extraction**: Convert unstructured resume text into JSON objects
- **PocketFlow Integration**: Demonstrates prep → exec → post pattern
- **Two Learning Levels**: From basic concepts to production implementation
- **Type Safety**: Full TypeScript support in production version

## Quick Setup & Run

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Set your OpenAI API key:**
    ```bash
    export OPENAI_API_KEY="your-api-key-here"
    ```
    
    Or create a `.env` file:
    ```bash
    echo "OPENAI_API_KEY=your-api-key-here" > .env
    ```

3. **Run the extraction:**
    ```bash
    # Learning version (manual approach)
    npm start
    
    # Production version (Instructor.js)
    npm run instructor
    ```

## What You'll See

Both versions extract the same data from a sample resume:
- **Personal Info**: Name, email, phone, location
- **Work Experience**: Company, position, duration, responsibilities  
- **Education**: Institution, degree, duration, details
- **Skills**: Technical and professional skills

### Learning Version Output (`npm start`):
```
🚀 PocketFlow Structured Output Tutorial
=========================================
This demo extracts structured data from resume text using GPT-4

📄 Processing sample resume: resume_001
📄 Preparing resume text for structured extraction...
🤖 Extracting structured data using GPT-4...
✨ Successfully extracted structured data

📋 Extracted Profile:
👤 Name: John Smith
📧 Email: john.smith@email.com
📞 Phone: (555) 123-4567
📍 Location: San Francisco, CA

💼 Experience (2 positions):
  1. Senior Software Engineer at TechCorp Inc. (2020-2023)
  2. Software Engineer at StartupXYZ (2018-2020)

🎓 Education (2 entries):
  1. Master of Science in Computer Science from Stanford University (2016-2018)
  2. Bachelor of Science in Computer Science from UC Berkeley (2012-2016)

🛠️ Skills (14): JavaScript, Python, Java, Go, React...

✅ Structured extraction complete!

📋 Raw extracted data (JSON):
{
  "name": "John Smith",
  "email": "john.smith@email.com",
  "phone": "(555) 123-4567",
  "location": "San Francisco, CA",
  "experience": [
    {
      "company": "TechCorp Inc.",
      "position": "Senior Software Engineer",
      "duration": "2020-2023",
      "description": [
        "Led development of microservices architecture serving 1M+ users",
        "Implemented CI/CD pipelines reducing deployment time by 60%",
        "Mentored team of 5 junior developers"
      ]
    }
    // ... more experience entries
  ],
  "education": [
    {
      "institution": "Stanford University", 
      "degree": "Master of Science in Computer Science",
      "duration": "2016-2018",
      "details": [
        "GPA: 3.8/4.0",
        "Coursework: Machine Learning, Distributed Systems, Algorithms"
      ]
    }
    // ... more education entries
  ],
  "skills": [
    "JavaScript", "Python", "Java", "Go", "React", "Node.js",
    "Express", "Django", "PostgreSQL", "MongoDB", "Redis", 
    "AWS", "Docker", "Kubernetes"
  ]
}
```

### Production Version Output (`npm run instructor`):
```
🚀 PocketFlow + Instructor Structured Output Tutorial
====================================================
This demo extracts structured data using GPT-4 + Instructor.js

📄 Processing sample resume: resume_001
📄 Preparing resume text for structured extraction...
🤖 Extracting structured data using GPT-4 + Instructor...
✨ Successfully extracted and validated structured data

✅ Structured extraction complete!

📋 Extracted & Validated Data (JSON):
{
  "name": "John Smith",
  "email": "john.smith@email.com",
  // ... same structured data but with automatic validation
}
```

## How It Works

```mermaid
flowchart LR
    extraction[StructuredOutputNode] --> complete[End]
```

Both implementations use the same PocketFlow pattern but with different approaches:

### 📚 **Learning Version (`main.ts`)**
- **`prep()`**: Prepares resume text for processing
- **`exec()`**: Uses custom schema function + manual JSON parsing
- **`post()`**: Stores data and ends flow
- **Key insight**: See how `createExtractionSchema()` defines the output structure

### 🚀 **Production Version (`main-instructor.ts`)**  
- **`prep()`**: Prepares resume text for processing
- **`exec()`**: Uses Zod schema + Instructor for type-safe extraction
- **`post()`**: Stores validated data and ends flow
- **Key insight**: Zod schema provides both validation AND TypeScript types

## Why Use the Production Version?

1. **Type Safety** - Automatic TypeScript type inference from Zod schemas
2. **Validation** - Built-in data validation with detailed error messages  
3. **Reliability** - No manual JSON parsing that can fail
4. **Maintainability** - Schema changes automatically update types
5. **Battle-tested** - Instructor.js is used in production by many companies

## API Usage

Both versions provide reusable extraction functions:

### Learning Version:
```typescript
import { extractFromResume } from './main';

const resumeText = `Your resume text here...`;
const profile = await extractFromResume(resumeText);
console.log(profile);
```

### Production Version (Recommended):
```typescript
import { extractFromResumeWithInstructor } from './main-instructor';

const resumeText = `Your resume text here...`;
const profile = await extractFromResumeWithInstructor(resumeText);
// profile is fully typed and validated!
console.log(profile.name); // TypeScript knows this is a string
```

## Customization

### Using Your Own Resume

Both versions use the same sample data array - edit either file:

```typescript
const sampleResumes = [
  {
    id: "my_resume", 
    rawText: `Your actual resume text here...`
  }
];
```

### Modifying the Output Structure

#### Learning Version (`main.ts`):
```typescript
private createExtractionSchema() {
  return {
    name: "Full name of the person",
    // Add your custom fields
    certifications: ["certification1", "certification2"],
    // Remove fields you don't need  
  };
}
```

#### Production Version (`main-instructor.ts`) - Recommended:
```typescript
const ExtractionSchema = z.object({
  name: z.string().describe("Full name of the person"),
  // Add new fields with validation
  certifications: z.array(z.string()).describe("Professional certifications"),
  languages: z.array(z.string()).describe("Programming languages"),
  // Optional fields
  salary_expectation: z.number().optional().describe("Expected salary"),
});
```

The Zod approach provides automatic TypeScript types AND runtime validation!

## Files

- [`main.ts`](./main.ts): **Learning Version** - Manual approach with custom schema function
- [`main-instructor.ts`](./main-instructor.ts): **Production Version** - Type-safe extraction with Instructor.js
- [`package.json`](./package.json): Node.js package configuration with both implementations  
- [`tsconfig.json`](./tsconfig.json): TypeScript compilation settings

## Key Learning Points

### From Learning Version:
1. **Schema-Driven Extraction**: See how `createExtractionSchema()` defines output structure
2. **PocketFlow Pattern**: Understand prep → exec → post flow for data processing
3. **Manual JSON Handling**: Learn the challenges of parsing LLM responses

### From Production Version:
1. **Type Safety**: Zod schemas generate TypeScript types automatically
2. **Validation**: Built-in runtime validation prevents bad data
3. **Reliability**: No manual JSON parsing - Instructor handles it all
4. **Best Practices**: Production-ready structured output extraction

## Recommendation

🚀 **Use the Production Version (`main-instructor.ts`) for real applications!** The learning version is great for understanding concepts, but Instructor.js provides the reliability and type safety you need in production.
