import * as bp from '.botpress'
import axios from 'axios';

interface ConversionRates {
  [currency: string]: number;
}

interface APIResponse {
  result: string;
  time_last_update_utc: string;
  base_code: string;
  conversion_rates: ConversionRates;
}

interface BotState {
  baseCurrency: string;
}

const bot = new bp.Bot<BotState>({
  actions: {},
  states: {
    baseCurrency: { type: 'string', default: 'USD' }
  },
});

// Cache setup
const rateCache: { [base: string]: { data: APIResponse, timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const API_KEY = process.env.EXCHANGE_RATE_API_KEY || 'a2f65b4c569cb2b4ed3b18e1';

async function getExchangeRates(baseCurrency: string): Promise<APIResponse> {
  // Check cache
  if (rateCache[baseCurrency] && Date.now() - rateCache[baseCurrency].timestamp < CACHE_DURATION) {
    return rateCache[baseCurrency].data;
  }

  try {
    const response = await axios.get<APIResponse>(
      `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${baseCurrency}`
    );
    
    if (response.data.result !== 'success') {
      throw new Error('API error: ' + response.data.result);
    }

    // Update cache
    rateCache[baseCurrency] = {
      data: response.data,
      timestamp: Date.now()
    };
    
    return response.data;
  } catch (error) {
    throw new Error(`Exchange API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

bot.on.message("*", async (props) => {
  const { message, client, conversation, ctx, state } = props;
  const conversationId = conversation.id;
  const userId = ctx.botId;
  const currentBase = state.baseCurrency || 'USD';

  // Only handle text messages
  if (message.type !== "text") {
    return client.createMessage({
      conversationId,
      userId,
      type: "text",
      payload: { text: "Please send text commands" },
    });
  }

  const text = message.payload.text.trim();

  try {
    // Set base currency
    if (/set base currency to (\w{3})/i.test(text)) {
      const newBase = text.match(/set base currency to (\w{3})/i)![1].toUpperCase();
      
      // Test currency
      const testRates = await getExchangeRates('USD');
      if (!testRates.conversion_rates[newBase]) {
        return client.createMessage({
          conversationId,
          userId,
          type: "text",
          payload: { text: `❌ Currency not supported` },
        });
      }

      await state.set({ baseCurrency: newBase });
      return client.createMessage({
        conversationId,
        userId,
        type: "text",
        payload: { text: `✅ Base set to ${newBase}` },
      });
    }

    // Show current base
    if (/current base/i.test(text)) {
      return client.createMessage({
        conversationId,
        userId,
        type: "text",
        payload: { text: `Current base: ${currentBase}` },
      });
    }

    // Show exchange rates
    if (/exchange rates/i.test(text)) {
      const base = text.match(/for (\w{3})/i)?.[1]?.toUpperCase() || currentBase;
      const ratesData = await getExchangeRates(base);
      
      const response = `💱 1 ${base} equals:\n`
        + `USD: ${ratesData.conversion_rates.USD?.toFixed(4) || 'N/A'}\n`
        + `EUR: ${ratesData.conversion_rates.EUR?.toFixed(4) || 'N/A'}\n`
        + `GBP: ${ratesData.conversion_rates.GBP?.toFixed(4) || 'N/A'}\n`
        + `JPY: ${ratesData.conversion_rates.JPY?.toFixed(4) || 'N/A'}\n`
        + `...\nUpdated: ${new Date(ratesData.time_last_update_utc).toLocaleTimeString()}`;
      
      return client.createMessage({
        conversationId,
        userId,
        type: "text",
        payload: { text: response },
      });
    }

    // Currency conversion
    const convertMatch = text.match(/(?:convert|exchange) (\d+(?:\.\d+)?) (\w{3}) to (\w{3})/i) 
                       || text.match(/(?:convert|exchange) (\d+(?:\.\d+)?) to (\w{3})/i);
    
    if (convertMatch) {
      const amount = parseFloat(convertMatch[1]);
      let fromCurrency, toCurrency;
      
      if (convertMatch[3]) { // Full format: "convert 100 USD to EUR"
        fromCurrency = convertMatch[2].toUpperCase();
        toCurrency = convertMatch[3].toUpperCase();
      } else { // Short format: "convert 100 to EUR"
        fromCurrency = currentBase;
        toCurrency = convertMatch[2].toUpperCase();
      }

      const ratesData = await getExchangeRates(fromCurrency);
      const rate = ratesData.conversion_rates[toCurrency];
      
      if (!rate) {
        return client.createMessage({
          conversationId,
          userId,
          type: "text",
          payload: { text: `❌ Invalid currency pair` },
        });
      }

      const result = (amount * rate).toFixed(2);
      return client.createMessage({
        conversationId,
        userId,
        type: "text",
        payload: { text: `💱 ${amount} ${fromCurrency} = ${result} ${toCurrency}` },
      });
    }

    // Help command
    if (/help|commands/i.test(text)) {
      return client.createMessage({
        conversationId,
        userId,
        type: "text",
        payload: {
          text: `💡 Currency Bot Commands:\n• Set base currency to EUR\n• Current base currency\n• Exchange rates\n• Convert 100 USD to EUR\n• Convert 100 to EUR (uses current base)`
        },
      });
    }

    // Default response
    return client.createMessage({
      conversationId,
      userId,
      type: "text",
      payload: {
        text: `Try currency commands:\n• "Convert 100 USD to EUR"\n• "Exchange rates"\n• "Set base currency to GBP"\n• "Help" for more`
      },
    });

  } catch (error) {
    return client.createMessage({
      conversationId,
      userId,
      type: "text",
      payload: { 
        text: "⚠️ Service unavailable. Try again later." 
      },
    });
  }
});

export default bot;