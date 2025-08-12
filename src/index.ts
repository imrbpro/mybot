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
const bot = new bp.Bot({
  actions: {},
})

export default bot
