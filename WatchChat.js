require('dotenv').config();
const OpenAI = require('openai');
const { Chat, ChatEvents } = require("twitch-js");

const token = process.env['TWITCH_TOKEN']
const username = process.env['TWITCH_USERNAME']
const channel = "nomakk";

let ChatArray = [];

let LastConversation = DateTime.now();

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function askGpt(constructedMessage,chat) {
    try{
        console.log(constructedMessage);
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: constructedMessage}],
            model: 'gpt-3.5-turbo',
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

const run = async () => {
    const chat = new Chat({
      username,
      token
    });
  
    await chat.connect();
    await chat.join(channel);
  
    chat.on("PRIVMSG", (message) => {
    //    const time = new Date(message.timestamp).toTimeString();
      //  const event = message.event || message.command;
     //   const channel = message.channel;
        const msg = message.message || "";
        const username = message.username || "";
        console.log(ChatArray.length);
        const savedMsg = `${username}: ${msg}`;
        ChatArray.push(savedMsg);
        if(ChatArray.length > 5){
         console.log("sending to GPT");
         //console.log(ChatArray);
         fireGTPmessage(chat);
        }
      });
  };
  
function fireGTPmessage(chat){
    let chatMessages = ChatArray.join(";");
    let constructedMessage = "You will read trough chat messages and add your own matching response to the chat like a real person. Write a single short sentence which will match the context of the previous messages in the chat in style of slightly arogant but super smart developer: " + chatMessages;
    askGpt(constructedMessage,chat);
    ChatArray = []; //clear the array
}

function respondToChat(channel, message, chat){
    if (typeof message === 'string' && message.trim() !== '') {
        chat.say(channel, message);
    } else {
        console.error('Invalid message:', message);
    }
}

  run();

//askGpt();
