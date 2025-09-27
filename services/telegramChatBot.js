// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { ChatOpenAI } = require('@langchain/openai');
const { StateGraph, MessagesAnnotation, START, END, MemorySaver } = require('@langchain/langgraph');
const { HumanMessage } = require('@langchain/core/messages');
const axios = require('axios');

// Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const llm = new ChatOpenAI({ model: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY, maxTokens: 1000 });

const memory = new MemorySaver();
var JWTtoken = "";

const SYSTEM_PROMPT = `You are ResolveAI, a complaint management assistant for Sacred Heart College (Autonomous), Thevara.

Your capabilities:
- Help students submit complaints using the submit_complaint tool
- Provide guidance on complaint procedures
- Be empathetic and professional
- Ask clarifying questions when needed

Important:
- Always authenticate users with college credentials using the user_auth tool when the chat begins, otherwise the submit_complaint tool doesn't work.
- Once a complaint is submitted, provide the complaint ID to the user
- When user requests to view their complaints, use the fetch_complaints tool to retrieve and display them.

Guidelines:
- Always be polite and understanding
- When a user describes a problem, offer to submit it as a formal complaint
- Use the submit_complaint tool for formal submissions`;

// Tool Definitions
class SubmitComplaintTool {
    name = "submit_complaint";
    description = "Submit complaint to backend";
    schema = {
        type: "object",
        properties: {
            complaintText: { type: "string" }
        },
        required: ["complaintText"]
    };
    
    async call({ complaintText }) {
        try {
            const response = await axios.post('http://localhost:5000/api/complaints/process', 
                { complaintText: complaintText }, // Send complaintText as expected by server
                { headers: { 'Authorization': `Bearer ${process.env.BEARER_TOKEN}` } }
            );

            const response_submit = await axios.post('http://localhost:5000/api/complaints/', 
                { title: response.data.processedComplaint.title,
                    description: response.data.processedComplaint.desc,
                    category: response.data.processedComplaint.category,
                    department: response.data.processedComplaint.department,
                    academic_department: response.data.processedComplaint.academic_department,
                    priority: response.data.processedComplaint.priority,
                    comments: response.data.processedComplaint.comments
                  },
                { headers: { 'Authorization': `Bearer ${JWTtoken}` } }
            );
            return `Complaint submitted successfully: ${response_submit.data} with id ${response_submit.data._id}`;
        } catch (error) {
            console.error('Complaint submission error:', error.response?.data || error.message);
            return `❌ Error submitting complaint: ${error.response?.data?.error || error.message}`;
        }
    }
}

class UserAuthTool {
    
    name = "user_auth";
    description = "Authenticate user with college credentials";
    schema = {
        type: "object",
        properties: {
            email: { type: "string" },
            password: { type: "string" }
        },
        required: ["email", "password"]
    };
    
    async call({ email, password }) {
        try {
            const response = await axios.post('http://localhost:5000/api/auth/login',
                { email, password }
            );
            JWTtoken = response.data.token; // Store the token for future use
            return `User authenticated successfully. Token: ${response.data.token}`;
        } catch (error) {
            console.error('Authentication error:', error.response?.data || error.message);
            return `❌ Error authenticating user: ${error.response?.data?.error || error.message}`;
        }
    }
}

class FetchComplaintsTool {
    name = "fetch_complaints";
    description = "Fetch all complaints registered by the authenticated user";
    schema = {
        type: "object",
        properties: {},
        required: []
    };
    
    async call() {
        try {
            if (!JWTtoken) {
                return "❌ Please authenticate first using your college credentials before fetching complaints.";
            }

            const response = await axios.get('http://localhost:5000/api/complaints', {
                headers: { 'Authorization': `Bearer ${JWTtoken}` }
            });

            if (!response.data || response.data.length === 0) {
                return "No complaints found for your account.";
            }

            // Extract complaint IDs and create button data
            const complaintData = response.data.map(complaint => ({
                id: complaint._id,
                title: complaint.title,
                status: complaint.status
            }));
            return `COMPLAINTS_BUTTONS:${JSON.stringify(complaintData)}`;
        } catch (error) {
            console.error('Fetch complaints error:', error.response?.data || error.message);
            return `❌ Error fetching complaints: ${error.response?.data?.error || error.message}`;
        }
    }
}

const tools = [new SubmitComplaintTool(), new UserAuthTool(), new FetchComplaintsTool()];

const modelWithTools = llm.bindTools(tools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.schema }
})));

// LangGraph Nodes
async function chatbot(state) {
    const messages = state.messages;
    if (messages.length === 1) {
        messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
}

async function callTools(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = lastMessage.tool_calls || [];
    
    const results = [];
    for (const toolCall of toolCalls) {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
            const result = await tool.call(toolCall.args);
            results.push({ role: "tool", content: result, tool_call_id: toolCall.id });
        }
    }
    return { messages: results };
}

// Build Graph
const graph = new StateGraph(MessagesAnnotation)
    .addNode("chatbot", chatbot)
    .addNode("tools", callTools)
    .addEdge(START, "chatbot")
    .addConditionalEdges("chatbot", (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        return lastMessage.tool_calls?.length > 0 ? "tools" : END;
    })
    .addEdge("tools", "chatbot")
    .compile({ checkpointer: memory });

// Telegram Handler
bot.on('message', async (msg) => {
    if (!msg.text) return;
    
    try {
        const threadId = msg.chat.id.toString();
        const result = await graph.invoke(
            { messages: [new HumanMessage(msg.text)] },
            { configurable: { thread_id: threadId } }
        );
        
        const response = result.messages[result.messages.length - 1];  
        bot.sendMessage(msg.chat.id, response.content);
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Error processing message: ${error.message}`);
    }
});

console.log('Bot running...');
