import { Node, Flow } from 'pocketflow';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// STEP 1: Define the shared state for our PocketFlow node
// We'll define the extraction structure in the schema function below
interface SharedState {
  resumeText: string;
  extractedProfile?: any; // Using 'any' since we define structure in the schema function
}

// STEP 2: Sample resume data for testing
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

// STEP 3: Create a PocketFlow node that extracts structured data from resume text
class StructuredOutputNode extends Node<SharedState> {
  private client: OpenAI;

  constructor() {
    super();
    // Initialize OpenAI client with API key from environment
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
    });
  }

  // STEP 3A: prep() - Prepare the data for processing
  // Takes the resume text from shared state and returns it for exec()
  async prep(shared: SharedState): Promise<string> {
    console.log('📄 Preparing resume text for structured extraction...');
    return shared.resumeText;
  }

  // STEP 3B: exec() - Core processing logic 
  // Takes resume text and calls GPT-4 to extract structured data
  async exec(resumeText: string): Promise<any> {
    console.log('🤖 Extracting structured data using GPT-4...');

    // Define what data structure we want to extract - this is our "schema"
    const extractionSchema = this.createExtractionSchema();

    // Create the prompt with our schema
    const prompt = `
Extract structured information from this resume and return it as a JSON object with the following structure:

${JSON.stringify(extractionSchema, null, 2)}

Resume text:
${resumeText}

Return only the JSON object, no additional text or markdown formatting.`;

    // Call OpenAI API with the prompt
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting structured data from resumes. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1 // Low temperature for consistent extraction
    });

    // Get the response text
    const extractedText = response.choices[0].message.content;
    if (!extractedText) {
      throw new Error('No response from OpenAI');
    }

    // clean the response and get the json part of the response, no need to understand what is happeneing here, as we will just use instructor.js to to get the json resopnse later
    let cleanedText = extractedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse the JSON response into our extracted data
    const extractedData = JSON.parse(cleanedText);
    console.log('✨ Successfully extracted structured data');
    
    return extractedData;
  }

  // STEP 3C: post() - Handle the results and display output
  // Takes the extracted data and displays it nicely, then ends the flow
  async post(shared: SharedState, prepRes: string, execRes: any): Promise<string | undefined> {
    // Store the extracted profile in shared state for later use
    shared.extractedProfile = execRes;
    
    console.log('\n✅ Structured extraction complete!');
    return undefined; // Return undefined to end the flow
  }

  // STEP 3D: Define the structure we want to extract from resumes
  // This is the single source of truth for our data extraction format
  private createExtractionSchema() {
    return {
      name: "Full name of the person",
      email: "Email address", 
      phone: "Phone number",
      location: "Location/Address",
      experience: [
        {
          company: "Company name",
          position: "Job title",
          duration: "Time period",
          description: ["Key responsibility 1", "Key responsibility 2"]
        }
      ],
      education: [
        {
          institution: "School/University name",
          degree: "Degree type and field",
          duration: "Time period",
          details: ["Additional detail 1", "Additional detail 2"]
        }
      ],
      skills: ["skill1", "skill2", "skill3"]
    };
  }
}

// STEP 4: Main function to run the structured output extraction
async function main() {
  console.log('🚀 PocketFlow Structured Output Tutorial');
  console.log('=========================================');
  console.log('This demo extracts structured data from resume text using GPT-4\n');
  
  try {
    // Use the first sample resume from our test data
    const sampleResume = sampleResumes[0];
    console.log(`📄 Processing sample resume: ${sampleResume.id}`);
    
    // Initialize shared state with the resume text
    const shared: SharedState = {
      resumeText: sampleResume.rawText
    };
    
    // Create the extraction node and wrap it in a PocketFlow
    const extractionNode = new StructuredOutputNode();
    const flow = new Flow(extractionNode);
    
    // Run the extraction flow (this will call prep -> exec -> post)
    await flow.run(shared);
    
    // Display the raw JSON data for reference
    if (shared.extractedProfile) {
      console.log('\n📋 Raw extracted data (JSON):');
      console.log(JSON.stringify(shared.extractedProfile, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error running structured output flow:', error);
    process.exit(1);
  }
}

// STEP 5: Helper function for processing any resume text
// This allows others to use our extraction logic in their own code
export async function extractFromResume(resumeText: string): Promise<any> {
  // Set up shared state with the provided resume text
  const shared: SharedState = {
    resumeText: resumeText
  };
  
  // Create and run the extraction flow
  const extractionNode = new StructuredOutputNode();
  const flow = new Flow(extractionNode);
  await flow.run(shared);
  
  // Return the extracted profile or throw an error
  if (!shared.extractedProfile) {
    throw new Error('Failed to extract profile data');
  }
  
  return shared.extractedProfile;
}

// STEP 6: Run the main function if this file is executed directly
if (require.main === module) {
  main();
}
