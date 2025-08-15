import * as bp from '.botpress'
import axios, { AxiosResponse } from 'axios';

interface ConversionRates {
  [currency: string]: number;
}

interface APIResponse {
  result: string;
  time_last_update_utc: string;
  base_code: string;
  conversion_rates: ConversionRates;
}

const API_KEY = 'a2f65b4c569cb2b4ed3b18e1';

const bot = new bp.Bot({
  actions: {},
})

async function getExchangeRates(baseCurrency: string): Promise<APIResponse> {
  try {
    const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCurrency}`;
    const response: AxiosResponse<APIResponse> = await axios.get(url);
    
    if (response.data.result !== 'success') {
      throw new Error(`API error: ${response.data.result}`);
    }
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to retrieve exchange rates. Please try again later.`);
  }
}

const sendMessage = (client: any, conversationId: string, userId: string, text: string) => {
  return client.createMessage({
    conversationId,
    userId,
    type: "text",
    payload: { text },
  });
};

bot.on.message("*", async (props) => {
  const { message, client, conversation, ctx } = props;
  const { id: conversationId } = conversation;
  const { botId: userId } = ctx;

  if (message.type !== "text") {
    return sendMessage(client, conversationId, userId, "Sorry, I can only respond to text messages.");
  }

  const text = message.payload.text.trim();
  const words = text.toLowerCase().split(' ');
  
  if (words[0] === 'convert' && words[1] && words[2] === 'to' && words[3]) {
    const amount = parseFloat(words[1]);
    const fromCurrency = words[1].toUpperCase();
    const toCurrency = words[3].toUpperCase();

    if (isNaN(amount)) {
      return sendMessage(client, conversationId, userId, "Invalid amount. Please provide a number.");
    }
    
    if (fromCurrency.length !== 3 || toCurrency.length !== 3) {
      return sendMessage(client, conversationId, userId, `Invalid currency codes. Please use 3-letter codes, e.g., "convert 100 USD to EUR".`);
    }

    try {
      const ratesData = await getExchangeRates(fromCurrency);
      const rate = ratesData.conversion_rates[toCurrency];
      
      if (!rate) {
        return sendMessage(client, conversationId, userId, `Invalid currency pair. Could not find a rate for ${fromCurrency} to ${toCurrency}.`);
      }

      const result = (amount * rate).toFixed(2);
      return sendMessage(client, conversationId, userId, `💱 ${amount} ${fromCurrency} = ${result} ${toCurrency}`);
    } catch (error) {
      console.error(error);
      return sendMessage(client, conversationId, userId, "An unexpected error occurred. Please try again later.");
    }
  }

  return sendMessage(client, conversationId, userId, "I'm a simple currency converter. Try: 'convert 100 USD to EUR'");
});

export default bot;
