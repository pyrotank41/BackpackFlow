import { Node, Flow } from 'pocketflow';
import { z } from 'zod';
import { getInstructorClient } from './utils';

// STEP 1: Define structured output schemas using Zod for type safety

// Outline schema - structured JSON output for article outline
const OutlineSchema = z.object({
  sections: z.array(z.string().describe("Section title")).max(3).describe("List of up to 3 main article sections")
});

// Section content schema - for individual section content
const SectionContentSchema = z.object({
  title: z.string().describe("Section title"),
  content: z.string().describe("Section content (around 100 words)"),
  word_count: z.number().describe("Actual word count of the content")
});

// Final article schema - for the styled article
const ArticleSchema = z.object({
  title: z.string().describe("Engaging article title"),
  content: z.string().describe("Full article content in conversational style"),
  word_count: z.number().describe("Total word count of the article")
});

// STEP 2: Define types from schemas
type Outline = z.infer<typeof OutlineSchema>;
type SectionContent = z.infer<typeof SectionContentSchema>;
type Article = z.infer<typeof ArticleSchema>;

// STEP 3: Define shared state for the workflow
interface WorkflowState {
  topic: string;
  outline?: Outline;
  sections?: SectionContent[];
  finalArticle?: Article;
}

// STEP 4: Create PocketFlow nodes using Instructor for structured output

class OutlineNode extends Node<WorkflowState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: WorkflowState): Promise<string> {
    console.log(`\n📋 Generating outline for topic: "${shared.topic}"`);
    return shared.topic;
  }

  async exec(topic: string): Promise<Outline> {
    const outline = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert content strategist. Create clear, logical article outlines."
        },
        {
          role: "user",
          content: `Create a simple outline for an article about "${topic}". 
                   The outline should have up to 3 main sections that cover the topic comprehensively.
                   Make the section titles clear and engaging.`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: OutlineSchema,
        name: "ArticleOutline"
      },
      temperature: 0.7
    });

    console.log(`✨ Outline created with ${outline.sections.length} sections`);
    return outline;
  }

  async post(shared: WorkflowState, prepRes: string, execRes: Outline): Promise<string> {
    shared.outline = execRes;
    
    console.log('\n📋 Outline:');
    execRes.sections.forEach((section, index) => {
      console.log(`  ${index + 1}. ${section}`);
    });
    
    return "content"; // Move to content generation
  }
}

class ContentNode extends Node<WorkflowState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: WorkflowState): Promise<{ topic: string; sections: string[] }> {
    console.log('\n✍️ Writing content for each section...');
    
    if (!shared.outline) {
      throw new Error('No outline found in shared state');
    }
    
    return {
      topic: shared.topic,
      sections: shared.outline.sections
    };
  }

  async exec(input: { topic: string; sections: string[] }): Promise<SectionContent[]> {
    const sections: SectionContent[] = [];
    
    for (const [index, sectionTitle] of input.sections.entries()) {
      console.log(`📝 Writing section ${index + 1}: ${sectionTitle}`);
      
      const sectionContent = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert writer who explains complex topics in simple, clear language."
          },
          {
            role: "user",
            content: `Write content for the section "${sectionTitle}" in an article about "${input.topic}".
                     
                     Requirements:
                     - Write approximately 100 words
                     - Use simple, clear language
                     - Make it educational and informative
                     - Avoid jargon and complex terms
                     - Make it engaging for a general audience`
          }
        ],
        model: "gpt-4o",
        response_model: {
          schema: SectionContentSchema,
          name: "SectionContent"
        },
        temperature: 0.7
      });
      
      sections.push(sectionContent);
      console.log(`   ✓ ${sectionContent.word_count} words`);
    }
    
    console.log('✨ Content generation complete');
    return sections;
  }

  async post(shared: WorkflowState, prepRes: any, execRes: SectionContent[]): Promise<string> {
    shared.sections = execRes;
    
    console.log('\n📄 Section Contents:');
    execRes.forEach((section, index) => {
      console.log(`\n--- ${section.title} ---`);
      console.log(section.content);
    });
    
    return "style"; // Move to style application
  }
}

class StyleNode extends Node<WorkflowState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: WorkflowState): Promise<{ topic: string; sections: SectionContent[] }> {
    console.log('\n🎨 Applying conversational style...');
    
    if (!shared.sections) {
      throw new Error('No sections found in shared state');
    }
    
    return {
      topic: shared.topic,
      sections: shared.sections
    };
  }

  async exec(input: { topic: string; sections: SectionContent[] }): Promise<Article> {
    // Combine all section content
    const combinedContent = input.sections.map(section => 
      `## ${section.title}\n\n${section.content}`
    ).join('\n\n');
    
    const styledArticle = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert content writer who creates engaging, conversational articles that feel personal and approachable."
        },
        {
          role: "user",
          content: `Rewrite this article about "${input.topic}" in a conversational, engaging style.
                   
                   Original content:
                   ${combinedContent}
                   
                   Requirements:
                   - Make it conversational and engaging
                   - Use "you" to address the reader directly
                   - Add personality and warmth
                   - Use analogies and examples when helpful
                   - Create smooth transitions between sections
                   - Start with an engaging introduction
                   - End with a memorable conclusion
                   - Keep the same core information but make it more engaging`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: ArticleSchema,
        name: "StyledArticle"
      },
      temperature: 0.8
    });
    
    console.log('✨ Style transformation complete');
    return styledArticle;
  }

  async post(shared: WorkflowState, prepRes: any, execRes: Article): Promise<string | undefined> {
    shared.finalArticle = execRes;
    
    console.log('\n📄 Final Article:');
    console.log('='.repeat(50));
    console.log(`# ${execRes.title}\n`);
    console.log(execRes.content);
    console.log('='.repeat(50));
    
    // Display statistics
    const draftWords = shared.sections?.reduce((sum, section) => sum + section.word_count, 0) || 0;
    console.log('\n📊 Workflow Statistics:');
    console.log(`- Topic: ${shared.topic}`);
    console.log(`- Sections: ${shared.outline?.sections.length || 0}`);
    console.log(`- Draft words: ${draftWords}`);
    console.log(`- Final article words: ${execRes.word_count}`);
    
    console.log('\n✅ Workflow Complete!');
    return undefined; // End the workflow
  }
}

// STEP 5: Create and run the article workflow
async function runArticleWorkflow(topic: string = "AI Safety"): Promise<WorkflowState> {
  console.log('🚀 Article Writing Workflow - PocketFlow + Instructor');
  console.log('====================================================');
  console.log(`Topic: ${topic}\n`);
  
  // Initialize shared state
  const shared: WorkflowState = {
    topic: topic
  };
  
  // Create nodes
  const outlineNode = new OutlineNode();
  const contentNode = new ContentNode();
  const styleNode = new StyleNode();
  
  // Connect nodes in sequence
  outlineNode.on("content", contentNode);
  contentNode.on("style", styleNode);
  
  // Create and run the flow
  const flow = new Flow(outlineNode);
  await flow.run(shared);
  
  return shared;
}

// STEP 6: Helper function for external use
export async function generateArticle(topic: string): Promise<{
  outline: Outline;
  sections: SectionContent[];
  finalArticle: Article;
}> {
  const result = await runArticleWorkflow(topic);
  
  if (!result.outline || !result.sections || !result.finalArticle) {
    throw new Error('Workflow did not complete successfully');
  }
  
  return {
    outline: result.outline,
    sections: result.sections,
    finalArticle: result.finalArticle
  };
}

// STEP 7: Main execution
async function main() {
  try {
    // Get topic from command line arguments or use default
    const topic = process.argv[2] || "AI Safety";
    
    const result = await runArticleWorkflow(topic);
    
    // Optionally save the article to a file
    if (process.env.SAVE_ARTICLE === 'true') {
      const fs = require('fs');
      const filename = `article-${topic.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
      const content = `# ${result.finalArticle?.title}\n\n${result.finalArticle?.content}`;
      fs.writeFileSync(filename, content);
      console.log(`\n💾 Article saved to: ${filename}`);
    }
    
  } catch (error) {
    console.error('❌ Error running article workflow:', error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
