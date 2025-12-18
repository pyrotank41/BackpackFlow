import { Node, Flow } from 'pocketflow';
import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// STEP 1: Define the structured output schema using Zod
// This replaces our manual schema function with type-safe validation
const ExtractionSchema = z.object({
  name: z.string().describe("Full name of the person"),
  email: z.string().describe("Email address"),
  phone: z.string().describe("Phone number"), 
  location: z.string().describe("Location/Address"),
  experience: z.array(z.object({
    company: z.string().describe("Company name"),
    position: z.string().describe("Job title"),
    duration: z.string().describe("Time period"),
    description: z.array(z.string()).describe("Key responsibilities")
  })).describe("Work experience history"),
  education: z.array(z.object({
    institution: z.string().describe("School/University name"),
    degree: z.string().describe("Degree type and field"),
    duration: z.string().describe("Time period"),
    details: z.array(z.string()).optional().describe("Additional details like GPA, honors, etc.")
  })).describe("Educational background"),
  skills: z.array(z.string()).describe("Technical and professional skills")
});

// STEP 2: Infer the TypeScript type from the Zod schema
type ExtractedProfile = z.infer<typeof ExtractionSchema>;

// STEP 3: Define shared state for PocketFlow
interface SharedState {
  resumeText: string;
  extractedProfile?: ExtractedProfile;
}

// STEP 4: Sample resume data for testing
const sampleResumes = [
  {
    id: "resume_001",
    rawText: `
John Smith
Email: john.smith@email.com
Phone: (555) 123-4567
Location: San Francisco, CA

EXPERIENCE
Senior Software Engineer | TechCorp Inc. | 2020-2023
• Led development of microservices architecture serving 1M+ users
• Implemented CI/CD pipelines reducing deployment time by 60%
• Mentored team of 5 junior developers

Software Engineer | StartupXYZ | 2018-2020
• Built full-stack web applications using React and Node.js
• Designed REST APIs handling 10K+ requests per minute
• Collaborated with cross-functional teams in agile environment

EDUCATION
Master of Science in Computer Science | Stanford University | 2016-2018
• GPA: 3.8/4.0
• Coursework: Machine Learning, Distributed Systems, Algorithms

Bachelor of Science in Computer Science | UC Berkeley | 2012-2016
• GPA: 3.6/4.0
• Magna Cum Laude

SKILLS
Programming Languages: JavaScript, Python, Java, Go
Frameworks: React, Node.js, Express, Django
Databases: PostgreSQL, MongoDB, Redis
Cloud: AWS, Docker, Kubernetes
`
  }
];

// STEP 5: Create PocketFlow node using Instructor for structured extraction
class InstructorExtractionNode extends Node<SharedState> {
  private client: any; // Instructor client

  constructor() {
    super();
    // Initialize OpenAI client
    const oai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
    });
    
    // Wrap with Instructor for structured outputs
    this.client = Instructor({
      client: oai,
      mode: "FUNCTIONS"
    });
  }

  // STEP 5A: prep() - Prepare the data for processing
  async prep(shared: SharedState): Promise<string> {
    console.log('📄 Preparing resume text for structured extraction...');
    return shared.resumeText;
  }

  // STEP 5B: exec() - Use Instructor to extract structured data
  async exec(resumeText: string): Promise<ExtractedProfile> {
    console.log('🤖 Extracting structured data using GPT-4 + Instructor...');

    // Use Instructor to get structured output with automatic validation
    const extractedData = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured data from resumes. Extract all relevant information accurately."
        },
        {
          role: "user", 
          content: `Extract structured information from this resume:\n\n${resumeText}`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: ExtractionSchema,
        name: "ExtractedProfile"
      },
      temperature: 0.1
    });

    console.log('✨ Successfully extracted and validated structured data');
    return extractedData;
  }

  // STEP 5C: post() - Handle results and display
  async post(shared: SharedState, prepRes: string, execRes: ExtractedProfile): Promise<string | undefined> {
    // Store the extracted profile in shared state
    shared.extractedProfile = execRes;
    
    console.log('\n✅ Structured extraction complete!');
    return undefined; // End the flow
  }
}

// STEP 6: Main function to run the extraction
async function main() {
  console.log('🚀 PocketFlow + Instructor Structured Output Tutorial');
  console.log('====================================================');
  console.log('This demo extracts structured data using GPT-4 + Instructor.js\n');
  
  try {
    // Use the first sample resume
    const sampleResume = sampleResumes[0];
    console.log(`📄 Processing sample resume: ${sampleResume.id}`);
    
    // Initialize shared state
    const shared: SharedState = {
      resumeText: sampleResume.rawText
    };
    
    // Create and run the extraction flow
    const extractionNode = new InstructorExtractionNode();
    const flow = new Flow(extractionNode);
    await flow.run(shared);
    
    // Display the extracted data
    if (shared.extractedProfile) {
      console.log('\n📋 Extracted & Validated Data (JSON):');
      console.log(JSON.stringify(shared.extractedProfile, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error running extraction flow:', error);
    process.exit(1);
  }
}

// STEP 7: Helper function for reusable extraction
export async function extractFromResumeWithInstructor(resumeText: string): Promise<ExtractedProfile> {
  const shared: SharedState = {
    resumeText: resumeText
  };
  
  const extractionNode = new InstructorExtractionNode();
  const flow = new Flow(extractionNode);
  await flow.run(shared);
  
  if (!shared.extractedProfile) {
    throw new Error('Failed to extract profile data');
  }
  
  return shared.extractedProfile;
}

// STEP 8: Run the main function if executed directly
if (require.main === module) {
  main();
}
