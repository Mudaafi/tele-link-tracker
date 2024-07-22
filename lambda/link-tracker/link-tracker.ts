import { Handler } from '@netlify/functions'
import { Telegram } from 'telegram-interface'
import {
  TeleCallbackQuery,
  TeleError,
  TeleMessage,
  TeleMessageEntities,
  TeleUpdate,
} from 'telegram-interface/lib/@types/telegram-types'
import { embedMetadata } from 'telegram-interface/lib/telegram-formatters'
import {
  appendToSheet,
  getLastRowIndex,
  getRowIndexFromResult,
} from './lib/gsheet-interface'

const GSHEET_ID = '169qZKbEAb5rMeyEHNNjA0fGxs0-atTEF60PDDT8U1gY'
const SHEET_NAME = 'Links Tracked'

export const handler: Handler = async (event, context) => {
  if (event.httpMethod == 'POST') {
    const botKey = process.env.BOT_TOKEN

    if (!botKey)
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Server doesn't have the required credentials.",
        }),
      }

    const teleClient = new Telegram(botKey)
    const prompt = JSON.parse(event.body || '{}')
    const httpResponse = await processTelePrompt(teleClient, prompt)

    return httpResponse
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: `Request fell through`,
    }),
  }
}

async function processTelePrompt(client: Telegram, prompt: TeleUpdate) {
  try {
    if (prompt.message) return await processTeleMsg(client, prompt.message)
    else if (prompt.callback_query)
      return await processTeleCallback(client, prompt.callback_query)
  } catch (e) {
    const errorMsg = await processTeleError(client, prompt, e as TeleError)
    console.log(e)

    return errorMsg
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: `Request fell through.`,
    }),
  }
}

async function processTeleMsg(client: Telegram, message: TeleMessage) {
  const ADMIN_ID = process.env.ADMIN_ID || ''
  const senderId = message.from?.id.toString()

  if (senderId && senderId !== ADMIN_ID) {
    await client.sendMessage(
      senderId,
      "Sorry, this bot hasn't been enabled for non-premium users",
    )
  } else if (senderId === ADMIN_ID) {
    const urlArr =
      message.entities?.filter((entity) => entity.type === 'url') || []

    if (urlArr?.length > 0) {
      // Is a url, store it
      await urlFlow(client, message, urlArr)
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Tele Message processed`,
    }),
  }
}

async function urlFlow(
  client: Telegram,
  message: TeleMessage,
  urlEntityArr: Array<TeleMessageEntities>,
) {
  if (!message.from?.id) return

  const urlArr = urlEntityArr
    .map((entity) => {
      return message.text?.slice(entity.offset, entity.offset + entity.length)
    })
    .filter((url) => url !== null && url !== undefined)

  let msg = `URLs stored in sheet: ???`
  urlArr.forEach((url) => (msg += `\n  - ${url}`))
  msg += '\n\nReply to this message to set a description for the links stored'
  msg = embedMetadata([], msg)

  let lastRowIndex = await getLastRowIndex(GSHEET_ID, SHEET_NAME)
  const rowsToAppend = urlArr.map((url) => [lastRowIndex++, url])

  await appendToSheet(rowsToAppend, 'A:B', GSHEET_ID, SHEET_NAME)
  return client.sendMessage(message.from?.id, msg)
}

async function processTeleCallback(
  client: Telegram,
  message: TeleCallbackQuery,
) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: `Callbacks are unsupported`,
    }),
  }
}

export async function processTeleError(
  teleClient: Telegram,
  prompt: TeleUpdate,
  errorMsg: TeleError,
) {
  const ADMIN_ID = Netlify.env.get('ADMIN_ID') || ''

  await teleClient.sendMessage(ADMIN_ID, `<b>Error encountered</b>:`)
  await teleClient.sendMessage(ADMIN_ID, JSON.stringify(prompt))
  await teleClient.sendMessage(ADMIN_ID, `${errorMsg.description}`)

  return {
    statusCode: 500,
    body: JSON.stringify({
      message: `Internal Server Error`,
    }),
  }
}
