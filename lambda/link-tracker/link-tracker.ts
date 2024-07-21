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
    const apiKey = Netlify.env.get('BOT_TOKEN')

    if (!apiKey)
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Server doesn't have the required credentials.",
        }),
      }

    const teleClient = new Telegram(apiKey)
    const prompt = JSON.parse(event.body || '')
    await processTelePrompt(teleClient, prompt)
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
    if (prompt.message) await processTeleMsg(client, prompt.message)
    else if (prompt.callback_query)
      await processTeleCallback(client, prompt.callback_query)
  } catch (e) {
    await processTeleError(client, prompt, e as TeleError)
    console.log(e)
  }
}

async function processTeleMsg(client: Telegram, message: TeleMessage) {
  const testMessage = '<b>New Message</b>\nHello World'
  const ADMIN_ID = Netlify.env.get('ADMIN_ID') || ''

  await client.sendMessage(ADMIN_ID, testMessage)
  return client.sendMessage(ADMIN_ID, message.text || 'undefined')
}

async function processTeleCallback(
  client: Telegram,
  message: TeleCallbackQuery,
) {}

export async function processTeleError(
  teleClient: Telegram,
  prompt: TeleUpdate,
  errorMsg: TeleError,
) {
  const ADMIN_ID = Netlify.env.get('ADMIN_ID') || ''

  await teleClient.sendMessage(ADMIN_ID, `<b>Error encountered</b>:`)
  await teleClient.sendMessage(ADMIN_ID, JSON.stringify(prompt))
  await teleClient.sendMessage(ADMIN_ID, `${errorMsg.description}`)
}
