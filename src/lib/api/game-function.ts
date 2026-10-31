import { ExecutionMethod } from 'appwrite'
import { functions, GAME_FUNCTION_ID } from '@/lib/appwrite'

// Calls the trusted `game` function as the signed-in user.
export async function callGameFunction<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const execution = await functions.createExecution({
    functionId: GAME_FUNCTION_ID,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })
  let payload: { message?: string } & Record<string, unknown> = {}
  try {
    payload = JSON.parse(execution.responseBody || '{}')
  } catch {
    // keep the empty payload
  }
  if (execution.responseStatusCode >= 400 || execution.status === 'failed') {
    throw new Error(payload.message || 'Request failed, please try again')
  }
  return payload as T
}
