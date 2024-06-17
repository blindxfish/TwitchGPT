require('dotenv').config();
const OpenAI = require('openai');
const { Chat } = require("twitch-js");

const token = process.env['TWITCH_TOKEN'];
const username = process.env['TWITCH_USERNAME'];
const channel = "blindflsh";

let sentMessages = [];
let recentActivity = 0;
const activityWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
const minInterval = 1 * 60 * 1000; // 1 minute in milliseconds
const maxInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
const highActivityThreshold = 10; // Number of messages in activityWindow considered high activity

let lastConversation = new Date(new Date().getTime() - minInterval);

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY']
});

const run = async () => {
    const chat = new Chat({
      username,
      token
    });
  
    await chat.connect();
    await chat.join(channel);

    // Function to check and fire message
    const checkAndFireMessage = async () => {
        const currentTime = new Date();
        if (currentTime - lastConversation >= getDynamicInterval()) {
            await fireMessage(chat);
            lastConversation = new Date();
        }
    };

    setInterval(checkAndFireMessage, 10000); // Checking every 10 seconds for the opportunity to fire a message

    chat.on("PRIVMSG", (message) => {
        const msg = message.message || "";
        const username = message.username || "";
        // Combine the username and message to form a unique entry
        const savedMsg = `${username}: ${msg}`;
        // Update sentMessages with the new message, ensure not to exceed the recent memory capacity
        if (sentMessages.length > 50) { // Adjust size limit as needed
            sentMessages.shift(); // Remove the oldest message
        }
        sentMessages.push(savedMsg);
        recentActivity++;
        setTimeout(() => recentActivity--, activityWindow); // Decrease activity count after the activity window
        lastConversation = new Date(); // Update the last conversation time to the current time
    });
};

function getDynamicInterval() {
    // Increase interval when activity is high, decrease when low
    const activityFactor = Math.max(0, Math.min(1, recentActivity / highActivityThreshold));
    return minInterval + activityFactor * (maxInterval - minInterval);
}

async function fireMessage(chat) {
    const options = [
        "!police", "!strobe", "!hearth", "!rainbow", "!storm", 
        "!disco", "!ocean", "!mystic", "!cool", "!passday", 
        "!dragoon", "!food", "Kappa", "Pog", "FeelsGoodMan", 
        "LUL", "CoolStoryBob"
    ];

    const noActivity = recentActivity === 0;
    if (noActivity) {
        // If there's no activity, send a random command or emote from options
        const randomCommand = options[Math.floor(Math.random() * options.length)];
        respondToChat(channel, randomCommand, chat);
    } else {
        // Generate a random message using ChatGPT
        const promptMessage = createRandomPrompt();
        await askGpt(promptMessage, chat);
    }
}

function createRandomPrompt() {
    const randomQuestions = [
        "Ask about the streamer's favorite game.",
        "Ask viewers about their day.",
        "Share a fun fact about gaming.",
        "Ask about upcoming games viewers are excited for.",
        "Mention a popular game and ask for opinions.",
        "Comment on the stream quality and ask for feedback.",
        "Ask viewers for movie recommendations.",
        "Talk about recent game updates or patches."
    ];

    const randomMemoryMessage = sentMessages.length > 0
        ? sentMessages[Math.floor(Math.random() * sentMessages.length)]
        : null;

    const randomIndex = Math.floor(Math.random() * randomQuestions.length);
    const randomPrompt = randomQuestions[randomIndex];

    let promptMessage = `Generate a short Twitch chat message. Use emojis and short sentences. Keep it under 50 characters. You can ask something like: ${randomPrompt}.`;
    
    if (randomMemoryMessage) {
        promptMessage += ` You can also refer to this recent message: "${randomMemoryMessage}".`;
    }

    return promptMessage;
}

function getLastChatter() {
    // Extract the last chatter's username from the array of sent messages
    const lastMessage = sentMessages[sentMessages.length - 1];
    return lastMessage ? lastMessage.split(":")[0] : null;
}

async function askGpt(promptMessage, chat) {
    try {
        console.log(promptMessage);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: promptMessage }],
            model: 'gpt-4-turbo',
            max_tokens: 60,
            stop: ['.']
        });

        let response = chatCompletion.choices[0].message.content.trim();
        if (response.length <= 50 && !sentMessages.includes(response)) {
            const messages = splitMessage(response);
            for (const msg of messages) {
                respondToChat(channel, msg, chat);
                sentMessages.push(msg); // Add each part of the response to sent messages to avoid repetition
                await delayRandom(); // Delay between each part of the response
            }
        } else {
            console.error('Invalid or repeated response:', response);
        }
    } catch (err) {
        console.error(err);
    }
}

function splitMessage(response) {
    // Split the response into short parts to simulate multiple lines
    const parts = response.match(/.{1,30}/g) || []; // Adjust length as needed
    return parts;
}

function respondToChat(channel, message, chat) {
    if (typeof message === 'string' && message.trim() !== '') {
        chat.say(channel, message);
    } else {
        console.error('Invalid message:', message);
    }
}

async function delayRandom() {
    const delay = Math.floor(Math.random() * 2000) + 500; // Random delay between 0.5s to 2.5s
    return new Promise(resolve => setTimeout(resolve, delay));
}

run();
