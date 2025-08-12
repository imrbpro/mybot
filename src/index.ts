import * as bp from '.botpress'
import axios from 'axios'

//declarations
interface ConversionRates{
  [currency:string] : number;
}
interface APIResponse{
  result: string;
  time_last_update_utc: string;
  base_code: string;
  conversion_rates: ConversionRates;
}
interface botState {
  baseCurrency:string;
}
const bot = new bp.Bot({
  actions: {},
  states:{
    baseCurrency: {type:'string', default: 'USD'}
  }
})

export default bot
