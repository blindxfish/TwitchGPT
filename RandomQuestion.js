require('dotenv').config();
const OpenAI = require('openai');
const { Chat, ChatEvents } = require("twitch-js");

const token = process.env['TWITCH_TOKEN']
const username = process.env['TWITCH_USERNAME']
const channel = "blindflsh";

let ChatArray = [];
const questionInterval = 5 * 60 * 1000; // 5 minutes in milliseconds - CHANGE THIS FOR THE FREQUENCY

// Set the initial last conversation time to 5 minutes ago
let lastConversation = new Date(new Date().getTime() - 50000);

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
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
        if (new Date() - lastConversation >= questionInterval) {
            await fireGTPmessage(chat);
            lastConversation = new Date();
        }
    };

    // Setting an interval to check every minute (or other preferred interval)
    setInterval(checkAndFireMessage, 10000); // 60000 milliseconds = 1 minute
    // Log remaining time every 10 seconds
    setInterval(logRemainingTime, 10 * 1000); // 10 seconds in milliseconds

    chat.on("PRIVMSG", (message) => {
    //    const time = new Date(message.timestamp).toTimeString();
      //  const event = message.event || message.command;
     //   const channel = message.channel;
        const msg = message.message || "";
        const username = message.username || "";
   //     console.log(ChatArray.length);
        const savedMsg = `${username}: ${msg}`;
        if(ChatArray.length > 10){
            ChatArray.shift();
            ChatArray.push(savedMsg);
        }else{
            ChatArray.push(savedMsg);
        }
        lastConversation = new Date(lastConversation.getTime());
      });
  };
  
function fireGTPmessage(chat){
   let lastQuestions = ChatArray.join(";");
   console.log(lastQuestions);

   //INSTRUCT THE BOT WHAT SHALL HE DO IN THE CHAT:
let constructedMessage = `Ask a random programming interwiev question that is not in this array: [${ChatArray.slice(-10).join(', ')}]`;
/*
let constructedMessage = `Say something short that fits the context of this conversation: [${ChatArray.slice(-10).join(', ')}]`;
*/
    askGpt(constructedMessage,chat);
}

async function askGpt(constructedMessage,chat) {
    try{
        console.log(constructedMessage);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: constructedMessage}],
            model: 'gpt-4',
        });
        // Log the response to the console
        let response = chatCompletion.choices[0].message;
        console.log(response.content);
        
        if (typeof response.content === 'string') {
            respondToChat(channel, response.content, chat);  
        } else {
            console.error('Invalid response:', response);
        }
    } catch (err) {
        console.error(err);
    }
}

function respondToChat(channel, message, chat){
    if (typeof message === 'string' && message.trim() !== '') {
        chat.say(channel, message);
    } else {
        console.error('Invalid message:', message);
    }
}

const logRemainingTime = () => {
    const currentTime = new Date();
    const timeElapsed = currentTime - lastConversation;
    const timeRemaining = questionInterval - timeElapsed;

    console.log(`Time until next question: ${Math.ceil(timeRemaining / 1000)} seconds`);
};

  run();

//askGpt();
