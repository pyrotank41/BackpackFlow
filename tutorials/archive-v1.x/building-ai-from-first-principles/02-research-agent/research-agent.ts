import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import { Node, Flow } from 'backpackflow/pocketflow';
import { OpenAIProvider } from 'backpackflow/providers';

import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);


type contextStorage = {
    context: string;
}

type searchResult = contextStorage & {
    query: string;
    maxResults: number;
    searchResults: string[];
}

type actions = {
    action: string;
    actionDescription: string;
    actionParameters: string[];
}

type decisionStorage = contextStorage & {
    availableActions: actions[];
    history: string[];
    currentAction: string;
}

type researchStorage = decisionStorage & searchResult & contextStorage;

let apikey = process.env.OPENAI_API_KEY
console.log(apikey)
if (apikey == undefined) { throw new Error("OPENAI_API_KEY not found") }
const llmProvider = new OpenAIProvider({ apiKey: apikey, model:"gpt-4o" })

class decisionNode extends Node<decisionStorage> {

    async prep(shared) {
        console.log("Decision node prep")
        return { context: shared["context"], question: shared["question"], availableActions: shared["availableActions"] }
    }

    async exec(prep_res) {
        console.log("Decision node exec")
        let { context, question, availableActions } = prep_res
        //We ask the LLM to decide what to do next with this prompt:
        const prompt = `### CONTEXT
You are a research assistant that can search the web. today is ${new Date().toLocaleDateString()}, time is ${new Date().toLocaleTimeString()}.
Question: ${question}
Previous Research: ${context}

### ACTION SPACE
[1] search
  Description: Look up more information on the web
  Parameters:
    - query (str): What to search for

[2] answer
  Description: Answer the question with current knowledge
  Parameters:
    - answer (str): Final answer to the question

### INSTRUCTIONS
Decide the next action based on the context and available actions.
Return your response in this EXACT format:

\`\`\`json
{
    "thinking": "<your step-by-step reasoning process>",
    "action": "search" OR "answer",
    "reason": "<why you chose this action>",
    "search_query": "<specific search query if action is search>",
}
\`\`\``
        
        const message = [{ role: 'system' as const, content: prompt }]

        console.log("Decision node exec message:")
        console.log(message)
        const response = await llmProvider.complete(message)

        const content = response.content

        // get the yaml string, between ``` and ```yaml
        const jsonString = content.match(/```json\n(.*?)\n```/s)?.[1]
        if (!jsonString) { throw new Error("No yaml string found") }
        console.log(jsonString)

        const result = JSON.parse(jsonString)
        console.log(result)
        return result
          
    }

    async post(shared, prepRes, execRes) {
        console.log("Decision node post")
        const action = execRes["action"]

        if (action == "search") {
            shared["currentAction"] = action
            shared["query"] = execRes["search_query"]
            console.log("Action: " + action + " with query: " + execRes["search_query"])
            return action
        }

        else if (action == "answer") {
            shared["currentAction"] = action
            console.log("Action: " + action)
            return action
        }
        else {
            throw new Error("Invalid action: " + action)
        }

    }
}


class searchNode extends Node<searchResult> {
    async prep(shared) {
        console.log("Search node prep")
        return { query: shared.query, maxResults: shared.maxResults }
    }

    async exec(prepRes) {
        console.log("Search node exec")
        let { query, maxResults } = prepRes
        if (maxResults == undefined || maxResults == null || maxResults == 0) { maxResults = 3 }
        const response = await exa.searchAndContents(query, { numResults: maxResults, highlights: true})
        console.log(response)

        const results = response.results
        const searchResults: string[] = []
        for (const result of results) {
            searchResults.push("\n   title: " + result.title + "\n   date: " + result.publishedDate + "\n   content: " + result.highlights + "\n" + "   url: " + result.url)
        }
        return searchResults.join("\n")
    }

    async post(shared, prepRes, execRes) {
        console.log("Search node post")
        const current_context = shared.context
        if (execRes == null) { return execRes }
        shared.context = `${current_context}\n\nSEARCH: ${shared.query}\nResults: ${execRes}`;
        // shared.searchResults.push(execRes)
        // console.log("Search results: " + execRes)
        console.log(`following is the context after the search: ${shared.context}`)
        return undefined  // This will use the "default" action set by .next()
    }
}

class finalAnswerNode extends Node {
    async prep(shared) {
        console.log("final answer node prep")
        shared.question = shared.question
        shared.context = shared.context
        return { question: shared.question, context: shared.context }
    }

    async exec(prepRes) {
        console.log("final answer node exec")
        let { question, context } = prepRes
        const system_message = `
### CONTEXT
Based on the following information, answer the question.
Question: ${question}
Research: ${context}

## YOUR ANSWER:
Provide a comprehensive answer using the research results.
`
        const message = [{ role: 'system' as const, content: system_message }]
        
        return (await llmProvider.complete(message)).content
    }

    async post(shared, prepRes, execRes) {
        console.log("final answer node post")
        console.log("Final answer: " + execRes)
        return execRes
    }
}


const decision_node = new decisionNode()
const search_node = new searchNode()
const final_answer_node = new finalAnswerNode()

decision_node.on("search", search_node)
decision_node.on("answer", final_answer_node)
search_node.next(decision_node)

const flow = new Flow(decision_node)

async function main() {
    const resp = await flow.run({
        question: "Who is the ceo of OpenAI?",
        context: ""
    });
    console.log("Response:");
    console.log(resp);
}

main().catch(console.error);