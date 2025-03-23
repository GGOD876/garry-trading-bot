// Enhanced version: Delayed confirmation on next candle
import { RSI, BollingerBands, PSAR } from "technicalindicators"

const TELEGRAM_TOKEN = Bun.env.TELEGRAM_TOKEN
const CHAT_ID = Bun.env.CHAT_ID

const OTC_PAIRS = [
  "AUDCAD=X",
  "AUDCHF=X",
  "AUDUSD=X",
  "EURCHF=X",
  "EURGBP=X",
  "EURJPY=X",
  "EURRUB=X",
  "EURUSD=X",
  "GBPJPY=X",
  "MADUSD=X",
  "NZDJPY=X",
  "USDBRL=X",
  "USDCOP=X",
  "USDDZD=X",
  "USDINR=X",
  "USDJPY=X",
  "USDPKR=X",
  "USDSGD=X",
  "USDTHB=X",
  "EURNZD=X",
  "CHFNOK=X",
  "CADJPY=X",
  "USDCHF=X",
  "USDPHP=X",
  "GBPUSD=X",
  "TNDUSD=X",
  "EURTRY=X",
  "LBPUSD=X",
  "USDIDR=X",
  "USDCAD=X",
  "AUDNZD=X",
  "USDMYR=X",
  "AUDJPY=X",
  "USDBDT=X",
  "YERUSD=X",
  "USDCLP=X",
  "USDVND=X",
  "CADCHF=X",
  "CHFJPY=X",
  "EURHUF=X",
  "USDCNH=X",
  "NZDUSD=X",
  "GBPAUD=X",
  "USDMXN=X",
  "USDRUB=X",
  "USDEGP=X",
  "USDARS=X",
]

let pendingSignals: { pair: string; type: "buy" | "sell" }[] = []

async function getPriceData(pair: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1m&range=2d`
  const res = await fetch(url)
  const json = await res.json()
  const candles = json.chart.result[0]
  return {
    close: candles.indicators.quote[0].close,
    high: candles.indicators.quote[0].high,
    low: candles.indicators.quote[0].low,
    timestamps: candles.timestamp,
  }
}

function detectSignal(pair: string, data: { close: number[]; high: number[]; low: number[] }): { pair: string; type: "buy" | "sell" } | null {
  const close = data.close.slice(-51, -1) // previous candle
  const high = data.high.slice(-51, -1)
  const low = data.low.slice(-51, -1)

  if (close.at(-1) === null) return null

  const rsi = RSI.calculate({ values: close, period: 14 })
  const rsiNow = rsi.at(-1)

  const bb = BollingerBands.calculate({ period: 20, values: close, stdDev: 2 })
  const bbNow = bb.at(-1)
  const priceNow = close.at(-1)

  const psar = PSAR.calculate({ high, low, step: 0.02, max: 0.2 })
  const psarNow = psar.at(-1)

  const supertrendRed = priceNow! < psarNow!
  const supertrendGreen = priceNow! > psarNow!

  const atUpperBand = priceNow! >= bbNow!.upper
  const atLowerBand = priceNow! <= bbNow!.lower

  const rsiHigh = rsiNow! > 65
  const rsiLow = rsiNow! < 35

  if (supertrendRed && atUpperBand && rsiHigh) return { pair, type: "sell" }
  if (supertrendGreen && atLowerBand && rsiLow) return { pair, type: "buy" }
  return null
}

function confirmSignal(pair: string, type: "buy" | "sell", data: { close: number[] }): boolean {
  const prev = data.close.at(-2)!
  const current = data.close.at(-1)!
  if (type === "sell") return current < prev
  if (type === "buy") return current > prev
  return false
}

async function sendTelegramMessage(text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  })
}

async function scanForPendingSignals() {
  for (const { pair, type } of pendingSignals) {
    try {
      const data = await getPriceData(pair)
      if (confirmSignal(pair, type, data)) {
        await sendTelegramMessage(`📣 ENTER NOW → ${type.toUpperCase()} ${pair.replace("=X", "")}`)
        console.log(`🚀 Confirmed ${type} signal for ${pair}`)
      } else {
        console.log(`❌ Signal on ${pair} not confirmed.`)
      }
    } catch (err) {
      console.error(`Error confirming ${pair}:`, err)
    }
  }
  pendingSignals = [] // Clear after processing
}

async function scanAllPairs() {
  for (const pair of OTC_PAIRS) {
    try {
      const data = await getPriceData(pair)
      const signal = detectSignal(pair, data)
      if (signal) {
        pendingSignals.push(signal)
        console.log(`⏳ Potential ${signal.type} signal on ${pair} — checking next candle...`)
      }
    } catch (err) {
      console.error(`Error fetching ${pair}:`, err)
    }
  }
  // After 1 minute, recheck
  setTimeout(scanForPendingSignals, 60 * 1000)
}

setInterval(scanAllPairs, 60 * 1000)
scanAllPairs()
