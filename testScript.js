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
let nextCheckTime = Math.random() * (maxInterval - minInterval) + minInterval;

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

    console.log("Bot has connected and joined the channel.");

    // Function to check and fire message
    const checkAndFireMessage = async () => {
        const currentTime = new Date();
        const timeSinceLastConversation = currentTime - lastConversation;
        console.log(`Checking if a message should be sent. Time since last message: ${timeSinceLastConversation / 1000} seconds.`);

        if (timeSinceLastConversation >= nextCheckTime) {
            const noActivity = timeSinceLastConversation >= maxInterval;
            console.log(`No activity: ${noActivity}. Firing a message.`);
            await fireMessage(chat, noActivity);
            lastConversation = new Date();
            nextCheckTime = Math.random() * (maxInterval - minInterval) + minInterval; // Recalculate interval for next check
            console.log(`Next message check in: ${nextCheckTime / 1000} seconds.`);
        } else {
            console.log(`No need to send a message yet. Next check in ${(nextCheckTime - timeSinceLastConversation) / 1000} seconds.`);
        }
    };

    setInterval(checkAndFireMessage, 10000); // Checking every 10 seconds for the opportunity to fire a message

    chat.on("PRIVMSG", (message) => {
        const msg = message.message || "";
        const username = message.username || "";
        // Combine the username and message to form a unique entry
        const savedMsg = `${username}: ${msg}`;
        console.log(`Received message: ${savedMsg}`);
        // Update sentMessages with the new message, ensure not to exceed the recent memory capacity
        if (sentMessages.size > 50) { // Adjust size limit as needed
            sentMessages.clear(); // Optionally clear or manage old entries differently
            console.log("Cleared sent messages to avoid overflow.");
        }
        sentMessages.add(savedMsg);
        lastConversation = new Date(); // Update the last conversation time to the current time
        nextCheckTime = Math.random() * (maxInterval - minInterval) + minInterval; // Recalculate interval after receiving a message
        console.log("Updated last conversation time.");
        console.log(`Next message check in: ${nextCheckTime / 1000} seconds.`);
    });
};

async function fireMessage(chat, noActivity) {
    const options = [
        "!police", "!strobe", "!hearth", "!rainbow", "!storm", 
        "!disco", "!ocean", "!mystic", "!cool", "!passday", 
        "!dragoon", "!food"
    ];

    if (noActivity) {
        // If there's no activity for a while, send a random command or emote
        const randomCommand = options[Math.floor(Math.random() * options.length)];
        console.log(`No activity detected for a while. Sending random command: ${randomCommand}`);
        respondToChat(channel, randomCommand, chat);
    } else {
        const lastMessage = getLastMessage();
        if (lastMessage) {
            // Respond to the last message with an emote or command
            const response = options[Math.floor(Math.random() * options.length)];
            console.log(`Responding to last message: ${lastMessage} with ${response}`);
            respondToChat(channel, response, chat);
        } else {
            const randomCommand = options[Math.floor(Math.random() * options.length)];
            console.log(`Sending random command: ${randomCommand}`);
            respondToChat(channel, randomCommand, chat);
        }
    }

    // Occasionally send a Hungarian message using ChatGPT
    if (Math.random() < 0.2) { // 20% chance to send a Hungarian message
        await askGpt("Mondj valamit magyarul", chat);
    }
}

function getLastMessage() {
    // Extract the last message from the set of sent messages
    const messagesArray = Array.from(sentMessages);
    return messagesArray.length > 0 ? messagesArray[messagesArray.length - 1] : null;
}

async function askGpt(promptMessage, chat) {
    try {
        console.log(`Sending prompt to OpenAI: ${promptMessage}`);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: promptMessage }],
            model: 'gpt-4-turbo-preview',
            max_tokens: 60,
            stop: ['.']
        });

        let response = chatCompletion.choices[0].message.content.trim();
        console.log(`Received response from OpenAI: ${response}`);
        if (response.length <= 60 && !sentMessages.has(response)) {
            console.log(`Valid response, sending to chat: ${response}`);
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
        console.log(`Message sent to chat: ${message}`);
    } else {
        console.error('Invalid message:', message);
    }
};

run();
