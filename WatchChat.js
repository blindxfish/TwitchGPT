require('dotenv').config();
const OpenAI = require('openai');
const { Chat } = require("twitch-js");

const token = process.env['TWITCH_TOKEN'];
const username = process.env['TWITCH_USERNAME'];
const channel = "blindflsh";

let sentMessages = new Set(); // Using a Set to store messages for better performance on lookups
const minInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
const maxInterval = 20 * 60 * 1000; // 20 minutes in milliseconds

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
        if (new Date() - lastConversation >= minInterval) {
            const noActivity = new Date() - lastConversation >= maxInterval;
            await fireMessage(chat, noActivity);
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
        if (sentMessages.size > 50) { // Adjust size limit as needed
            sentMessages.clear(); // Optionally clear or manage old entries differently
        }
        sentMessages.add(savedMsg);
        lastConversation = new Date(); // Update the last conversation time to the current time
    });
};

async function fireMessage(chat, noActivity) {
    const options = [
        "!police", "!strobe", "!hearth", "!rainbow", "!storm", 
        "!disco", "!ocean", "!mystic", "!cool", "!passday", 
        "!dragoon", "!food", "Kappa", "Pog", "FeelsGoodMan", 
        "LUL", "CoolStoryBob"
    ];

    if (noActivity) {
        // If there's no activity for a while, send a random command or emote
        const randomCommand = options[Math.floor(Math.random() * options.length)];
        respondToChat(channel, randomCommand, chat);
    } else {
        const previousChatter = getLastChatter();
        let promptMessage = `Generate a short Twitch chat message using one of these commands: ${options.join(', ')}.`;

        if (previousChatter) {
            promptMessage += ` You can also say hi to @${previousChatter}.`;
        }

        await askGpt(promptMessage, chat);
    }
}

function getLastChatter() {
    // Extract the last chatter's username from the set of sent messages
    const messagesArray = Array.from(sentMessages);
    const lastMessage = messagesArray[messagesArray.length - 1];
    return lastMessage ? lastMessage.split(":")[0] : null;
}

async function askGpt(promptMessage, chat) {
    try {
        console.log(promptMessage);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: promptMessage }],
            model: 'gpt-4-turbo-preview',
            max_tokens: 60,
            stop: ['.']
        });

        let response = chatCompletion.choices[0].message.content.trim();
        if (response.length <= 60 && !sentMessages.has(response)) {
            console.log(response);
            respondToChat(channel, response, chat);
            sentMessages.add(response); // Add the response to sent messages to avoid repetition
        } else {
            console.error('Invalid or repeated response:', response);
        }
    } catch (err) {
        console.error(err);
    }
}

function respondToChat(channel, message, chat) {
    if (typeof message === 'string' && message.trim() !== '') {
        chat.say(channel, message);
    } else {
        console.error('Invalid message:', message);
    }
};

run();
