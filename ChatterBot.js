require('dotenv').config();
const OpenAI = require('openai');
const { Chat } = require("twitch-js");

const token = process.env['TWITCH_TOKEN'];
const username = process.env['TWITCH_USERNAME'];
const channel = "blindflsh";

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY']
});

const STATES = {
  IDLE: 'Idle',
  RESPONDING: 'Responding',
  SENDING_EMOJI: 'SendingEmoji',
  ASKING_QUESTION: 'AskingQuestion',
  EXECUTING_BEHAVIOR: 'ExecutingBehavior'
};

const BEHAVIORS = [
    { name: 'RespondToSomeone', cost: 2, func: respondToSomeone },
    { name: 'SendAnEmoji', cost: 2, func: sendAnEmoji },
    { name: 'AskAQuestion', cost: 2, func: askAQuestion },
    { name: 'SendLightRedeem', cost: 2, func: sendLightRedeem } // Added new behavior
  ];

let sentMessages = [];
let recentActivity = 0;
const activityWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
const highActivityThreshold = 5; // Number of messages in activityWindow considered high activity
let minInterval = 5000;
let maxInterval = 60000;

let lastConversation = new Date(new Date().getTime() - minInterval);

let botState = STATES.IDLE;
let points = 0;

const chat = new Chat({
    username,
    token
  });

const run = async () => {
  

    await chat.connect();
    await chat.join(channel);

    setInterval(checkAndFireMessage, 10000); // Check every 10 seconds for the opportunity to fire a message
    setInterval(() => points++, 60000); // Accumulate points every minute

    setInterval(() => {
        console.log(`Bot status: State: ${botState}, Points: ${points}, Recent activity: ${recentActivity}, Sent messages count: ${sentMessages.length}`);
    }, 60000); // Log bot status every minute

    chat.on("PRIVMSG", (message) => {
        const msg = message.message || "";
        const username = message.username || "";
        const savedMsg = `${username}: ${msg}`;

        if (sentMessages.length > 50) {
            sentMessages.shift(); // Remove the oldest message
        }
        sentMessages.push(savedMsg);
        recentActivity++;
        setTimeout(() => recentActivity--, activityWindow); // Decrease activity count after the activity window

        lastConversation = new Date(); // Update the last conversation time to the current time

        if (botState === STATES.IDLE && Math.random<0.1) {
            botState = STATES.RESPONDING;
            executeBehavior(chat, BEHAVIORS[0]); // Respond to someone if idle
        }

        console.log(`Received message: ${savedMsg}, updating recent activity count to: ${recentActivity}`);
    });
};

function checkAndFireMessage() {
    const currentTime = new Date();
    const nextInterval = getDynamicInterval();
  //  console.log(`Checking if it's time to send a message. Current time: ${currentTime}, Last conversation: ${lastConversation}, Next interval: ${nextInterval}ms`);

    if (currentTime - lastConversation >= nextInterval) {
        if (botState === STATES.IDLE) {
            const availableBehaviors = BEHAVIORS.filter(b => b.cost <= points);
            if (availableBehaviors.length > 0) {
                const behavior = availableBehaviors[Math.floor(Math.random() * availableBehaviors.length)];
                executeBehavior(chat, behavior);
                points -= behavior.cost;
                console.log(`Executed behavior: ${behavior.name}, Points left: ${points}`);
            }
        }
        lastConversation = new Date();
    }
}

function getDynamicInterval() {
    const activityFactor = Math.max(0, Math.min(1, recentActivity / highActivityThreshold));
    return minInterval + activityFactor * (maxInterval - minInterval);
}

function executeBehavior(chat, behavior) {
    botState = STATES.EXECUTING_BEHAVIOR;
    behavior.func(chat);
    botState = STATES.IDLE;
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

    let promptMessage = `Generate a short Twitch chat message. Use sentences. Keep it under 50 characters. You can ask something like: ${randomPrompt}.`;
    
    if (randomMemoryMessage) {
        promptMessage += ` You can also refer to this recent message: "${randomMemoryMessage}".`;
    }

    console.log(`Generated prompt for ChatGPT: ${promptMessage}`);
    return promptMessage;
}

async function askGpt(promptMessage, chat) {
    try {
        console.log(`Asking ChatGPT with prompt: ${promptMessage}`);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: promptMessage }],
            model: 'gpt-4-turbo',
            max_tokens: 60,
            stop: ['.']
        });

        let response = chatCompletion.choices[0].message.content.trim();
        response = response.replace(/"/g, ''); // Remove all double quotes from the response
        console.log(`Received response from ChatGPT: ${response}`);
        if (response.length <= 50 && !sentMessages.includes(response)) {
            const messages = splitMessage(response);
            for (const msg of messages) {
                respondToChat(channel, msg, chat);
                sentMessages.push(msg);
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
    const parts = response.match(/.{1,30}/g) || [];
    return parts;
}

function respondToChat(channel, message, chat) {
    if (typeof message === 'string' && message.trim() !== '') {
        chat.say(channel, message);
        console.log(`Sent message to chat: ${message}`);
    } else {
        console.error('Invalid message:', message);
    }
}

async function delayRandom() {
    const delay = Math.floor(Math.random() * 2000) + 500;
    console.log(`Delaying next message by ${delay}ms`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/*Below are the behaviours 
*
*           
*/

async function respondToSomeone(chat) {
    if (sentMessages.length === 0) return;

    // Get the last 30 messages or all if less than 30
    const recentMessages = sentMessages.slice(-30);

    // Select a random message
    const randomMessage = recentMessages[Math.floor(Math.random() * recentMessages.length)];

    // Extract the username from the message
    const username = randomMessage.split(":")[0];

    // Generate a response
    const promptMessage = `Generate a short Twitch chat message responding to @${username}. Use emojis and short sentences. Keep it under 50 characters.`;
    
    try {
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: promptMessage }],
            model: 'gpt-4-turbo',
            max_tokens: 60,
            stop: ['.']
        });

        let response = chatCompletion.choices[0].message.content.trim();
        response = response.replace(/"/g, ''); // Remove all double quotes from the response
        console.log(`Received response from ChatGPT: ${response}`);
        if (response.length <= 50 && !sentMessages.includes(response)) {
            const messages = splitMessage(response);
            for (const msg of messages) {
                respondToChat(channel, msg, chat);
                sentMessages.push(msg);
                await delayRandom(); // Delay between each part of the response
            }
        } else {
            console.error('Invalid or repeated response:', response);
        }
    } catch (err) {
        console.error(err);
    }
}


async function sendLightRedeem(chat) {
    const lightRedeems = [
        "!police", "!strobe", "!hearth", "!rainbow", "!storm", 
        "!disco", "!ocean", "!mystic", "!cool", "!passday", 
        "!dragoon", "!food"
    ];
    const randomRedeem = lightRedeems[Math.floor(Math.random() * lightRedeems.length)];
    respondToChat(channel, randomRedeem, chat);
}

async function sendAnEmoji(chat) {
    const emojis = ["Kappa", "Pog", "FeelsGoodMan", "LUL", "CoolStoryBob"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    respondToChat(channel, randomEmoji, chat);
}

async function askAQuestion(chat) {
    const promptMessage = createRandomPrompt();
    await askGpt(promptMessage, chat);
}


run();
