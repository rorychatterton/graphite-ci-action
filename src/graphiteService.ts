import * as core from '@actions/core'
import * as github from '@actions/github'
import { WorkflowConfig } from './config'
import { name as packageName, version as packageVersion } from '../package.json'

interface RequestBodyContext {
  kind: 'GITHUB_ACTIONS'
  repository: {
    owner: string
    name: string
  }
  pr?: number
  sha: string
  ref: string
  head_ref?: string
  run: {
    workflow: string
    job: string
    run: number
  }
}

interface RequestBody {
  token: string
  caller: {
    name: string
    version: string
  }
  context: RequestBodyContext
}

interface ResponseBody {
  skip: boolean
  reason: string
}

/**
 * This function creates the request body for the Graphite service.
 */
function createRequestBody(graphiteToken: string): RequestBody {
  const { repo, payload, sha, ref, runId, workflow, job } = github.context

  return {
    token: graphiteToken,
    caller: {
      name: packageName,
      version: packageVersion
    },
    context: {
      kind: 'GITHUB_ACTIONS',
      repository: {
        owner: repo.owner,
        name: repo.repo
      },
      pr: payload.pull_request?.number,
      sha,
      ref,
      head_ref: process.env.GITHUB_HEAD_REF,
      run: {
        workflow,
        job,
        run: runId
      }
    }
  }
}

/**
 * This function handles the common non-200 responses from the Graphite service.
 */
async function handleNonOkResponse(
  response: Response,
  requestBody: RequestBody
): Promise<void> {
  switch (response.status) {
    case 401:
      core.warning('Invalid authentication. Please check your Graphite token.')
      break
    case 402:
      core.warning(
        'Your Graphite plan does not support the CI Optimizer. Please upgrade your plan to use this feature.'
      )
      break
    case 429:
      core.warning('Rate limit exceeded on Graphite Service.')
      break
    default:
      core.warning(
        'A non-200 status was seen when calling the Graphite Service.'
      )
      core.warning(
        `HTTP Response status: ${response.status}  (${response.statusText})`
      )
  }

  core.debug(`Request body: ${JSON.stringify(requestBody)}`)

  try {
    const errorBody = await response.text()
    core.debug(`Error response body: ${errorBody}`)
  } catch (error) {
    core.debug('Failed to read error response body')
  }

  core.info('Skip: False')
  core.setOutput('skip', false)
}

/**
 * This function makes a request to the Graphite service to determine if the workflow should be skipped.
 */
export async function requestWorkflow(config: WorkflowConfig): Promise<void> {
  const requestBody = createRequestBody(config.graphiteToken)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout * 1000
    )

    const result = await fetch(`${config.endpoint}/api/v1/ci/optimizer`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!result.ok) {
      await handleNonOkResponse(result, requestBody)
      return
    }

    const body = (await result.json()) as ResponseBody
    core.info(`skip: ${body.skip}`)
    core.setOutput('skip', body.skip)
    core.info(body.reason)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      core.warning(`Request timed out after ${config.timeout} seconds`)
    } else {
      core.warning('Failed to make request or parse response.')
    }
    if (error instanceof Error) {
      core.debug(`Error details: ${error.message}`)
    }
    core.info('skip: false')
    core.setOutput('skip', false)
  }
}
