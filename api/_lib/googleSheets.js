import { google } from 'googleapis';

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const subscriptionsSheetName = process.env.GOOGLE_SHEETS_SUBSCRIPTIONS_TAB || 'subscriptions';
const assignmentsSheetName = process.env.GOOGLE_SHEETS_ASSIGNMENTS_TAB || 'assignments';

const subscriptionsHeaders = ['email', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at', 'updated_at'];
const assignmentsHeaders = [
  'id',
  'email',
  'task_name',
  'pdf_url',
  'source_ref',
  'assigned_at',
  'acknowledged',
  'acknowledged_at'
];

function requireEnv(value, name) {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
}

function normalizeRows(values) {
  if (!values?.length) {
    return [];
  }

  const [headers, ...rows] = values;
  return rows
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] || '']));
      return {
        rowNumber: index + 2,
        record
      };
    })
    .filter((entry) => Object.values(entry.record).some(Boolean));
}

async function getSheetsApi() {
  requireEnv(spreadsheetId, 'GOOGLE_SHEETS_SPREADSHEET_ID');
  requireEnv(clientEmail, 'GOOGLE_SERVICE_ACCOUNT_EMAIL');
  requireEnv(privateKey, 'GOOGLE_PRIVATE_KEY');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

async function getSpreadsheet(sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return response.data;
}

async function ensureSheet(sheets, sheetName, headers) {
  const spreadsheet = await getSpreadsheet(sheets);
  const existingSheet = spreadsheet.sheets?.find((sheet) => sheet.properties?.title === sheetName);

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
  }

  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`
  });

  const values = valuesResponse.data.values || [];
  if (!values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers]
      }
    });
    return;
  }

  const existingHeaders = values[0];
  const mismatch =
    existingHeaders.length !== headers.length ||
    headers.some((header, index) => existingHeaders[index] !== header);

  if (mismatch) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers]
      }
    });
  }
}

async function getSheetRows(sheetName, headers) {
  const sheets = await getSheetsApi();
  await ensureSheet(sheets, sheetName, headers);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z`
  });

  return {
    sheets,
    rows: normalizeRows(response.data.values || [])
  };
}

async function appendRow(sheetName, headers, values) {
  const sheets = await getSheetsApi();
  await ensureSheet(sheets, sheetName, headers);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [values]
    }
  });
}

async function updateRow(sheetName, rowNumber, values) {
  const sheets = await getSheetsApi();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:${String.fromCharCode(64 + values.length)}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [values]
    }
  });
}

export async function upsertSubscription({ email, endpoint, p256dh, auth, userAgent }) {
  const now = new Date().toISOString();
  const { rows } = await getSheetRows(subscriptionsSheetName, subscriptionsHeaders);
  const existing = rows.find((row) => row.record.endpoint === endpoint);

  if (existing) {
    await updateRow(subscriptionsSheetName, existing.rowNumber, [
      email,
      endpoint,
      p256dh,
      auth,
      userAgent || '',
      existing.record.created_at || now,
      now
    ]);
    return;
  }

  await appendRow(subscriptionsSheetName, subscriptionsHeaders, [
    email,
    endpoint,
    p256dh,
    auth,
    userAgent || '',
    now,
    now
  ]);
}

export async function deleteSubscriptionByEndpoint(endpoint) {
  const sheets = await getSheetsApi();
  const spreadsheet = await getSpreadsheet(sheets);
  const sheet = spreadsheet.sheets?.find((entry) => entry.properties?.title === subscriptionsSheetName);
  if (!sheet) {
    return;
  }

  const { rows } = await getSheetRows(subscriptionsSheetName, subscriptionsHeaders);
  const existing = rows.find((row) => row.record.endpoint === endpoint);
  if (!existing) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: existing.rowNumber - 1,
              endIndex: existing.rowNumber
            }
          }
        }
      ]
    }
  });
}

export async function getSubscriptionsByEmail(email) {
  const { rows } = await getSheetRows(subscriptionsSheetName, subscriptionsHeaders);
  return rows
    .filter((row) => row.record.email === email)
    .map((row) => ({
      endpoint: row.record.endpoint,
      p256dh: row.record.p256dh,
      auth: row.record.auth
    }));
}

export async function createAssignment({ email, taskName, pdfUrl, sourceRef }) {
  const id = Date.now().toString();
  const assignedAt = new Date().toISOString();

  await appendRow(assignmentsSheetName, assignmentsHeaders, [
    id,
    email,
    taskName,
    pdfUrl,
    sourceRef || '',
    assignedAt,
    'false',
    ''
  ]);

  return {
    id,
    email,
    taskName,
    pdfUrl,
    sourceRef: sourceRef || '',
    assignedAt,
    acknowledged: false,
    acknowledgedAt: ''
  };
}

export async function getAssignmentById(id) {
  const { rows } = await getSheetRows(assignmentsSheetName, assignmentsHeaders);
  const match = rows.find((row) => row.record.id === String(id));
  if (!match) {
    return null;
  }

  return {
    rowNumber: match.rowNumber,
    id: match.record.id,
    email: match.record.email,
    taskName: match.record.task_name,
    pdfUrl: match.record.pdf_url,
    sourceRef: match.record.source_ref,
    assignedAt: match.record.assigned_at,
    acknowledged: match.record.acknowledged === 'true',
    acknowledgedAt: match.record.acknowledged_at || ''
  };
}

export async function acknowledgeAssignment({ assignmentId, email }) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment || assignment.email !== email) {
    return null;
  }

  const acknowledgedAt = new Date().toISOString();
  await updateRow(assignmentsSheetName, assignment.rowNumber, [
    assignment.id,
    assignment.email,
    assignment.taskName,
    assignment.pdfUrl,
    assignment.sourceRef || '',
    assignment.assignedAt,
    'true',
    acknowledgedAt
  ]);

  return {
    ...assignment,
    acknowledged: true,
    acknowledgedAt
  };
}
