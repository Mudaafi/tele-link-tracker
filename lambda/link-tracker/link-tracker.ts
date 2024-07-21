import { Handler } from '@netlify/functions'
import { Telegram } from 'telegram-interface'
import {
  TeleCallbackQuery,
  TeleError,
  TeleMessage,
  TeleUpdate,
} from 'telegram-interface/lib/@types/telegram-types'

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
      message: `Request fell through.`,
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
  const testMessage = '<b>New Message</b>\nHello World'
  const ADMIN_ID = process.env.ADMIN_ID || ''

  await client.sendMessage(ADMIN_ID, testMessage)
  await client.sendMessage(ADMIN_ID, message.text || 'undefined')

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Tele Message processed.`,
    }),
  }
}

async function processTeleCallback(
  client: Telegram,
  message: TeleCallbackQuery,
) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: `Callbacks unsupported.`,
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
