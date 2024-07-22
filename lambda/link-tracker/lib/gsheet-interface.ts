import { google, sheets_v4 } from 'googleapis'

const CLIENT_EMAIL = 'tele-link-tracker@fluffy-creates.iam.gserviceaccount.com'
let PRIVATE_KEY = process.env.GSHEET_KEY || 'No Private Key Found'
PRIVATE_KEY = PRIVATE_KEY.replace(new RegExp('\\\\n', 'g'), '\n')

const auth = new google.auth.JWT(
  CLIENT_EMAIL,
  undefined,
  PRIVATE_KEY,
  ['https://www.googleapis.com/auth/spreadsheets'],
  undefined,
)
google.options({ auth })
const sheets = google.sheets('v4')

/**
 * Writes one value to linked spreadsheet
 * @param cell <string> in the format "B2"
 * @param text <string | number | boolean> value to be written
 * @param sheetId <string> Spreadsheet Id
 * @param sheetName <string>
 */
export async function writeData(
  cell: string,
  text: string | number | boolean,
  sheetId: string,
  sheetName: string,
) {
  return new Promise((resolve, reject) => {
    const newData: sheets_v4.Schema$ValueRange = {
      values: [[text]],
    }
    sheets.spreadsheets.values.update(
      {
        spreadsheetId: sheetId,
        range: genOutputRange(sheetName, cell),
        valueInputOption: 'USER_ENTERED',
        includeValuesInResponse: true,
        requestBody: newData,
      } as sheets_v4.Params$Resource$Spreadsheets$Values$Update,
      (error, response) => {
        if (error) {
          console.log('The API returned an error: ' + error)
          return
        }
        resolve(response)
      },
    )
  })
}

/**
 * Writes one value to linked spreadsheet
 * @param range <string> in the format "B2:D2"
 * @param text <string | number | boolean> value to be written
 * @param sheetId <string> Spreadsheet Id
 * @param sheetName <string>
 */
export async function writeRow(
  range: string,
  row: Array<string | number | boolean | Date | null>,
  sheetId: string,
  sheetName: string,
) {
  return new Promise((resolve, reject) => {
    const newData: sheets_v4.Schema$ValueRange = {
      values: [row],
    }
    sheets.spreadsheets.values.update(
      {
        spreadsheetId: sheetId,
        range: genOutputRange(sheetName, range),
        valueInputOption: 'USER_ENTERED',
        includeValuesInResponse: true,
        requestBody: newData,
      } as sheets_v4.Params$Resource$Spreadsheets$Values$Update,
      (error, response) => {
        if (error) {
          console.log('The API returned an error: ' + error)
          return
        }
        resolve(response)
      },
    )
  })
}

/**
 * @params range String in this format "B2:C3" or "B:C"
 * @param range <string> in the format "B2:C3" or "B:C"
 * @param sheetId <string> Spreadsheet Id
 * @param sheetName <string>
 * @returns Promise<Array<Array<string>>> Array of rows
 */
export async function getData(
  range: string,
  sheetId: string,
  sheetName: string,
): Promise<Array<Array<string>>> {
  return new Promise(function (resolve, reject) {
    sheets.spreadsheets.values.get(
      {
        spreadsheetId: sheetId,
        range: genInputRange(sheetName, range),
      } as sheets_v4.Params$Resource$Spreadsheets$Get,
      (err: Error | null, res: any) => {
        if (err) return console.log('The API returned an error: ' + err)
        const rows = res.data.values
        if (rows.length) {
          resolve(rows)
        } else {
          console.log('No data found.')
        }
      },
    )
  })
}

/**
 * Appends 'rows' to a spreadsheet
 * @param rows Array<Array<string | number | boolean>> Array of rows to be appended
 * @param range <string> I don't think this matters (searches for an existing table within that range "B2:C3" or "B:C")
 * @param sheetID <string>
 * @param sheetName <string>
 * @returns
 */
export async function appendToSheet(
  rows: Array<Array<string | number | boolean | null>>,
  range: string,
  sheetID: string,
  sheetName: string,
) {
  return new Promise((res, rej) => {
    const body: sheets_v4.Schema$ValueRange = {
      values: rows,
    }
    sheets.spreadsheets.values.append(
      {
        spreadsheetId: sheetID,
        range: genOutputRange(sheetName, range),
        valueInputOption: 'USER_ENTERED',
        includeValuesInResponse: true,
        requestBody: body,
      } as sheets_v4.Params$Resource$Spreadsheets$Values$Append,
      (error, response) => {
        if (error) {
          console.log('The API returned an error: ' + error)
          rej(error)
          return
        } else {
          res(response)
        }
      },
    )
  })
}

export function getRowIndexFromResult(result) {
  const match = result.data.tableRange.match(/^.*![A-Z]+\d+:[A-Z]+(\d+)$/)
  const lastrow = match[1]

  return Number(lastrow)
}

export async function getLastRowIndex(sheetId, sheetName) {
  const lastRow = await appendToSheet([[null]], 'A:A', sheetId, sheetName)
  const rowIndex = getRowIndexFromResult(lastRow)

  return rowIndex
}

// --- Formatting Functions

function genOutputRange(sheetName: string, range: string): string {
  return sheetName + '!' + range
}

function genInputRange(sheetName: string, range: string): string {
  return sheetName + '!' + range
}
