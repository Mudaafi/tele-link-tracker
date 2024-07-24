import { Handler } from '@netlify/functions'
import { Telegram } from 'telegram-interface'
import {
  TeleCallbackQuery,
  TeleError,
  TeleMessage,
  TeleMessageEntities,
  TeleUpdate,
} from 'telegram-interface/lib/@types/telegram-types'
import {
  embedMetadata,
  extractMetadata,
} from 'telegram-interface/lib/telegram-formatters'
import {
  appendToSheet,
  getLastRowIndex,
  getRowIndexFromResult,
  writeRow,
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
    try {
      const prompt = JSON.parse(event.body || '{}')
      const httpResponse = await processTelePrompt(teleClient, prompt)

      return httpResponse
    } catch (err) {
      console.log(err)
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Internal Server Error`,
        }),
      }
    }
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

    if (hasReply(message)) {
      // Is a reply, try to add description to it
      await replyFlow(client, message)
    } else if (urlArr?.length > 0) {
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

async function replyFlow(
  client: Telegram,
  message: TeleMessage & { reply_to_message: TeleMessage },
) {
  const msgText = message.text
  const reply = message.reply_to_message
  const replyEntities = reply.entities
  const replyText = reply.text

  if (!msgText || !replyText || !replyEntities) return
  const meta = extractMetadata(replyText, replyEntities) || []
  const descriptions = msgText.split('\n-').map((d) => d.trim())

  await meta.forEach(async (rowIndex: number, i: number) => {
    await writeRow(`C${rowIndex}`, [descriptions[i]], GSHEET_ID, SHEET_NAME)
  })

  await client.setMessageReaction(reply.chat.id, reply.message_id, [
    { type: 'emoji', emoji: '✍' },
  ])

  await client.setMessageReaction(message.chat.id, message.message_id, [
    { type: 'emoji', emoji: '🫡' },
  ])
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

  let msg = `URLs stored in sheet: <b><a href="https://docs.google.com/spreadsheets/d/169qZKbEAb5rMeyEHNNjA0fGxs0-atTEF60PDDT8U1gY/edit?gid=0#gid=0">Link Tracker</a></b>`
  urlArr.forEach((url) => (msg += `\n  - ${url}`))
  msg += '\n\nReply to this message to set a description for the links stored'

  let lastRowIndex = (await getLastRowIndex(GSHEET_ID, SHEET_NAME)) + 1
  const rowsToAppend = urlArr.map((url) => [lastRowIndex++, url])
  const rowIndexes = rowsToAppend.map((row) => (row[0] as number) + 1)
  msg = embedMetadata(rowIndexes, msg)

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

// -- Type Guards
function hasReply(
  msg: TeleMessage,
): msg is TeleMessage & { reply_to_message: TeleMessage } {
  return !!msg.reply_to_message
}
